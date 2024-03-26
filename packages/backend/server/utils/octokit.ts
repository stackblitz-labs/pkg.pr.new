import type { H3Event } from "h3";
import type { App as AppType } from "octokit";
import { App } from "../vendor/octokit.mjs";

export function useOctokitApp(event: H3Event): AppType {
  const { appId, privateKey, webhookSecret } = useRuntimeConfig(event);
  console.log('env variables', appId, privateKey, webhookSecret)

  return new App({
    appId,
    privateKey,
    webhooks: { secret: webhookSecret },
  });
}
