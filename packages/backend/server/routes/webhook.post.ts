import type { PullRequestEvent } from "@octokit/webhooks-types";
import type { HandlerFunction } from "@octokit/webhooks/dist-types/types";
import type { PullRequestData, WorkflowData } from "../types";
import { hash } from "ohash";
import { abbreviateCommitHash } from "@pkg-pr-new/utils";

// mark a PR as a PR :)
const prMarkEvents: PullRequestEvent["action"][] = [
  "opened",
  "reopened",
  "synchronize",
];

export default eventHandler(async (event) => {
  const app = useOctokitApp(event);

  const { test } = useRuntimeConfig(event);
  const workflowsBucket = useWorkflowsBucket(event);
  const pullRequestNumbersBucket = usePullRequestNumbersBucket(event);
  const cursorBucket = useCursorsBucket(event);

  const workflowHandler: HandlerFunction<"workflow_job", unknown> = async ({
    payload,
  }) => {
    const [owner, repo] = payload.repository.full_name.split("/");

    const metadata = {
      owner,
      repo,
      job: payload.workflow_job.name,
      runId: payload.workflow_job.run_id,
      attempt: payload.workflow_job.run_attempt,
      actor: payload.sender.id,
    };
    const hashKey = hash(metadata);

    if (payload.action === "completed") {
      // Publishing is not available anymore
      await workflowsBucket.removeItem(hashKey);
    } else if (payload.action === 'in_progress') {
      const prData: PullRequestData = {
        owner,
        repo,
        ref: payload.workflow_job.head_branch!,
      };
      const prDataHash = hash(prData);
      const isPullRequest = await pullRequestNumbersBucket.hasItem(prDataHash);
      const prNumber = await pullRequestNumbersBucket.getItem(prDataHash);

      const data: WorkflowData = {
        owner,
        repo,
        sha: abbreviateCommitHash(payload.workflow_job.head_sha),
        ref: isPullRequest
          ? // it's a pull request workflow
            `${prNumber}`
          : payload.workflow_job.head_branch!,
      };

      // Publishing is only available throughout the lifetime of a workflow_job
      await workflowsBucket.setItem(hashKey, data);
    }
  };

  const pullRequestHandler: HandlerFunction<"pull_request", unknown> = async ({
    payload,
  }) => {
    const [owner, repo] = payload.repository.full_name.split("/");
    // TODO: functions that generate these kinda keys
    const key: PullRequestData = {
      owner,
      repo,
      ref: payload.pull_request.head.ref,
    };
    const prDataHash = hash(key);
    if (prMarkEvents.includes(payload.action)) {
      await pullRequestNumbersBucket.setItem(prDataHash, payload.number);
    } else if (payload.action === "closed") {
      await pullRequestNumbersBucket.removeItem(prDataHash);

      const baseKey = `${owner}:${repo}`;
      const cursorKey = `${baseKey}:${payload.pull_request.head.ref}`;

      await cursorBucket.removeItem(cursorKey);
    }
  };

  app.webhooks.on("workflow_job", workflowHandler);
  app.webhooks.on("pull_request", pullRequestHandler);

  type EmitterWebhookEvent = Parameters<
    typeof app.webhooks.receive | typeof app.webhooks.verifyAndReceive
  >[0];
  const id: EmitterWebhookEvent["id"] = event.headers.get("x-github-delivery")!;
  const name = event.headers.get(
    "x-github-event",
  ) as EmitterWebhookEvent["name"];
  const signature = event.headers.get("x-hub-signature-256") ?? "";
  const payload = (await readRawBody(event))!;

  try {
    if (test) {
      // TODO: fix typing with infer
      await app.webhooks.receive({
        id: id,
        name: name,
        payload: JSON.parse(payload),
      } as any);
    } else {
      await app.webhooks.verifyAndReceive({ id, name, payload, signature });
    }

    return { ok: true };
  } catch (error) {
    if (error instanceof Error) {
      app.log.error(error.message);
      throw createError({
        status: 500,
        message: error?.message,
      });
    }
  } finally {
    app.webhooks.removeListener("workflow_job", workflowHandler);
    app.webhooks.removeListener("pull_request", pullRequestHandler);
  }
});
