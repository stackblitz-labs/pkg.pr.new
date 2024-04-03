import type { HandlerFunction } from "@octokit/webhooks/dist-types/types";
import type { WorkflowData } from "../types";
import { hash } from "ohash";
import { usePullRequestNumbersBucket } from "../utils/bucket";

export default eventHandler(async (event) => {
  const app = useOctokitApp(event);

  const { test } = useRuntimeConfig(event);
  const { setItem, removeItem } = useWorkflowsBucket(event);
  const pullRequestNumbersBucket = usePullRequestNumbersBucket(event)

  const workflowHandler: HandlerFunction<"workflow_job", unknown> = async ({
    payload,
  }) => {
    const [owner, repo] = payload.repository.full_name.split("/");
    // const {} = await app.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/status', {
    //   owner,
    //   repo,
    //   head
    // })

    const metadata = {
      url: payload.workflow_job.html_url.split("/job/")[0], // run url: (https://github.com/stackblitz-labs/stackblitz-ci/actions/runs/8390507718)/job/23004786296
      attempt: payload.workflow_job.run_attempt,
      actor: payload.sender.id,
    };
    const hashKey = hash(metadata);
    if (payload.action === "queued") {
      const data: WorkflowData = {
        owner,
        repo,
        sha: payload.workflow_job.head_sha,
        ref: payload.workflow_job.head_branch!,
      };
      const prNumber = await pullRequestNumbersBucket.getItem(hash(data))
      if (prNumber) {
        // it's a pull request workflow
        data.ref = `pr-${prNumber}`
        data.isPullRequest = true
      }

      // Publishing is only available throughout the lifetime of a worklow_job
      await setItem(hashKey, data);
    } else if (payload.action === "completed") {
      // Publishing is not available anymore
      await removeItem(hashKey);
    }
  };

  const pullRequestHandler: HandlerFunction<"pull_request", unknown> = async ({
    payload
  }) => {
    if (payload.action === 'synchronize') {
      const [owner, repo] = payload.repository.full_name.split("/");
      const key: WorkflowData = {
        owner,
        repo,
        sha: payload.pull_request.head.sha,
        ref: payload.pull_request.head.ref,
      }
      const hashKey = hash(key)
      console.log('pullRequestHandler', key, payload.number)
      await pullRequestNumbersBucket.setItem(hashKey, payload.number)
      console.log('just set')
    } 
  }

  app.webhooks.on("workflow_job", workflowHandler);
  app.webhooks.on("pull_request", pullRequestHandler)

  type EmitterWebhookEvent = Parameters<
    typeof app.webhooks.receive | typeof app.webhooks.verifyAndReceive
  >[0];
  const id: EmitterWebhookEvent["id"] = event.headers.get("x-github-delivery")!;
  const name = event.headers.get(
    "x-github-event"
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
