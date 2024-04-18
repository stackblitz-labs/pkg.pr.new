import type { H3Event } from "h3";
import type { App as AppType } from "octokit";
import { App } from "../../vendor/octokit.build.mjs";

export function useOctokitApp(event: H3Event): AppType {
  const { appId, privateKey, webhookSecret } = useRuntimeConfig(event);

  return new App({
    appId,
    privateKey,
    webhooks: { secret: webhookSecret },
  }) as unknown as AppType;
}
