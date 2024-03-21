import {objectHash} from 'ohash'
import { App } from "octokit";

export default eventHandler(async (event) => {
  const { appId, privateKey, webhookSecret } = useRuntimeConfig(event);
  const app = new App({
    appId,
    privateKey,
    webhooks: {
      secret: webhookSecret,
    },
  });
  app.webhooks.on("workflow_job.queued", ({ octokit, payload }) => {
    const token = {
      url: payload.workflow_job.url,
      attempt: payload.workflow_job.run_attempt,
      actor: payload.sender.id
    }
    const hashedToken = objectHash(token)
    console.log(token)
    console.log(hashedToken)
  });

  type EmitterWebhookEvent = Parameters<typeof app.webhooks.receive>[0]
  const id: EmitterWebhookEvent['id'] = event.headers.get("x-github-delivery");
  const name = event.headers.get("x-github-event") as EmitterWebhookEvent['name'];
  const signature = event.headers.get("x-hub-signature-256") ?? "";
  const payloadString = await readRawBody(event);
  const payload = await readBody<EmitterWebhookEvent['payload']>(event);

  // Verify webhook signature
  try {
    await verifyWebhookSignature(payloadString, signature, webhookSecret);
  } catch (error) {
    app.log.warn(error.message);
    return new Response(`{ "error": "${error.message}" }`, {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Now handle the request
  try {
    await app.webhooks.receive({
      id,
      name,
      payload,
    } as EmitterWebhookEvent);

    return new Response(`{ "ok": true }`, {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    app.log.error(error);

    return new Response(`{ "error": "${error.message}" }`, {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});

// https://github.com/gr2m/cloudflare-worker-github-app-example/blob/main/lib/verify.js
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
) {
  if (!signature) {
    throw new Error("Signature is missing");
  } else if (!signature.startsWith("sha256=")) {
    throw new Error("Invalid signature format");
  }

  const algorithm = { name: "HMAC", hash: "SHA-256" };
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    algorithm,
    false,
    ["sign", "verify"]
  );

  const signed = await crypto.subtle.sign(
    algorithm.name,
    key,
    enc.encode(payload)
  );
  const expectedSignature = "sha256=" + array2hex(signed);
  if (!safeCompare(expectedSignature, signature)) {
    throw new Error("Signature does not match event payload and secret");
  }

  // All good!
}

function array2hex(arr: ArrayBuffer) {
  return [...new Uint8Array(arr)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison */
function safeCompare(expected: string, actual: string) {
  const lenExpected = expected.length;
  let result = 0;

  if (lenExpected !== actual.length) {
    actual = expected;
    result = 1;
  }

  for (let i = 0; i < lenExpected; i++) {
    result |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  }

  return result === 0;
}
