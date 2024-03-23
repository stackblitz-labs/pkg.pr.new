import type { HandlerFunction } from "@octokit/webhooks/dist-types/types";
import { objectHash, sha256 } from "ohash";
import { App } from "octokit";
import { WorkflowData } from "../types";

export default eventHandler(async (event) => {
  const { appId, privateKey, webhookSecret } = useRuntimeConfig(event);
  const app = new App({
    appId,
    privateKey,
    webhooks: {
      secret: webhookSecret,
    },
  });
  const { setItem, removeItem } = useBucket();

  const workflowHandler: HandlerFunction<"workflow_job", unknown> = async ({
    payload,
  }) => {
    const metadata = {
      url: payload.workflow_job.url,
      attempt: payload.workflow_job.run_attempt,
      actor: payload.sender.id,
    };
    const key = sha256(objectHash(metadata));
    if (payload.action === 'queued') {
      const [orgOrAuthor, repo]  = payload.repository.full_name.split('/')
      const data: WorkflowData = {
        orgOrAuthor,
        repo,
        sha: payload.workflow_job.head_sha,
        branch: payload.workflow_job.head_branch
      }
      // Publishing is only available throughout the lifetime of a worklow_job
      await setItem(key, JSON.stringify(data));
    } else if (payload.action === 'completed') {
      // Publishing is not available anymore
      await removeItem(key);
    }
  };
  
  app.webhooks.on("workflow_job", workflowHandler)

  type EmitterWebhookEvent = Parameters<typeof app.webhooks.receive>[0];
  const id: EmitterWebhookEvent["id"] = event.headers.get("x-github-delivery");
  const name = event.headers.get(
    "x-github-event"
  ) as EmitterWebhookEvent["name"];
  const signature = event.headers.get("x-hub-signature-256") ?? "";
  const payload = await readRawBody(event);

  try {
    await app.webhooks.verifyAndReceive({ id, name, payload, signature });

    return new Response(`{ "ok": true }`, {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    app.log.error(error.message);
    return new Response(`{ "error": "${error.message}" }`, {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } finally {
    app.webhooks.removeListener("workflow_job", workflowHandler)
  }
});
