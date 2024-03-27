import type { HandlerFunction } from "@octokit/webhooks/dist-types/types";
import type { WorkflowData } from "../types";
import { hash } from "ohash";

export default eventHandler(async (event) => {
  const app = useOctokitApp(event);

  const { test } = useRuntimeConfig(event);
  const { setItem, removeItem } = useWorkflowsBucket(event);

  console.log('start')
  const workflowHandler: HandlerFunction<"workflow_job", unknown> = async ({
    payload,
  }) => {
    console.log('payload', payload)
    const metadata = {
      url: payload.workflow_job.html_url.split("/job/")[0], // run url: (https://github.com/stackblitz-labs/stackblitz-ci/actions/runs/8390507718)/job/23004786296
      attempt: payload.workflow_job.run_attempt,
      actor: payload.sender.id,
    };
    const key = hash(metadata);
    if (payload.action === "in_progress") {
      const [orgOrAuthor, repo] = payload.repository.full_name.split("/");
      const data: WorkflowData = {
        orgOrAuthor,
        repo,
        sha: payload.workflow_job.head_sha,
        ref: payload.workflow_job.head_branch!,
      };

      console.log('queued', metadata, key)
      // octokit.request('POST /repos/{owner}/{repo}/pulls/{pull_number}/comments', {
      //   body: '',
      //   owner: payload.repository.owner,
      //   repo: payload.repository.repo

      // })
      // Publishing is only available throughout the lifetime of a worklow_job
      await setItem(key, data);
    } else if (payload.action === "completed") {
      // Publishing is not available anymore
      await removeItem(key);
    }
  };

  app.webhooks.on("workflow_job", workflowHandler);

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
  }
});
