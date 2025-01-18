import type { PullRequestEvent } from "@octokit/webhooks-types";
import type { HandlerFunction } from "@octokit/webhooks/dist-types/types";
import type { PullRequestData, WorkflowData } from "../types";
import { hash } from "ohash";

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

  const workflowHandler: HandlerFunction<"workflow_run", unknown> = async ({
    payload,
  }) => {
    const [owner, repo] = payload.repository.full_name.split("/");

    const metadata = {
      owner,
      repo,
      run: payload.workflow_run.id,
      attempt: payload.workflow_run.run_attempt,
      actor: payload.sender.id,
    };
    const hashKey = hash(metadata);

    if (payload.action === "completed") {
      // Publishing is not available anymore
      await workflowsBucket.removeItem(hashKey);
    } else if (!(await workflowsBucket.hasItem(hashKey))) {
      // "requested" or "in_progress"
      // "requested" won't be received in re-running workflow jobs, but "in_progress" would be
      const prData: PullRequestData = {
        full_name: payload.workflow_run.head_repository.full_name,
        ref: payload.workflow_run.head_branch,
      };
      // new: using the new key to avoid collision
      const prKey = `${prData.full_name}:${prData.ref}`;
      const isNewPullRequest = await pullRequestNumbersBucket.hasItem(prKey);

      // old: the old of hashing the prData started to hit collision, so we need to use the new one (e.g. https://github.com/element-plus/element-plus/actions/runs/12351113750/job/34465376908)
      const oldPrDataHash = hash(prData);
      const isOldPullRequest =
        await pullRequestNumbersBucket.hasItem(oldPrDataHash);

      const isPullRequest = isNewPullRequest || isOldPullRequest;
      const prNumber = await pullRequestNumbersBucket.getItem(
        isNewPullRequest ? prKey : oldPrDataHash,
      );

      const data: WorkflowData = {
        owner,
        repo,
        sha: payload.workflow_run.head_sha,
        ref: isPullRequest
          ? // it's a pull request workflow
            `${prNumber}`
          : payload.workflow_run.head_branch!,
      };

      // Publishing is only available throughout the lifetime of a workflow_job
      await workflowsBucket.setItem(hashKey, data);
    }
  };

  const pullRequestHandler: HandlerFunction<"pull_request", unknown> = async ({
    payload,
  }) => {
    // TODO: functions that generate these kinda keys
    const key: PullRequestData = {
      full_name: payload.pull_request.head.repo?.full_name!,
      ref: payload.pull_request.head.ref,
    };
    if (prMarkEvents.includes(payload.action)) {
      await pullRequestNumbersBucket.setItem(
        `${key.full_name}:${key.ref}`,
        payload.number,
      );
    }
  };

  app.webhooks.on("workflow_run", workflowHandler);
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
    app.webhooks.removeListener("workflow_run", workflowHandler);
    app.webhooks.removeListener("pull_request", pullRequestHandler);
  }
});
