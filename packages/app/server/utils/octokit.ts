import type { H3Event } from "h3";
import type { App as AppType } from "octokit";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { App, Octokit } from "octokit";

export function useOctokitApp(event: H3Event): AppType {
  try {
    const config = useRuntimeConfig(event);
    const { appId, privateKey, webhookSecret, ghBaseUrl } = config;

    if (!appId || !privateKey || !webhookSecret) {
      console.warn("Missing required GitHub App credentials in runtime config");
      return {
        octokit: { request: async () => ({ data: { id: 0 } }) },
        getInstallationOctokit: async () => ({}),
      } as any;
    }

    return new App({
      appId,
      privateKey,
      webhooks: { secret: webhookSecret },
      Octokit: Octokit.defaults({
        baseUrl: ghBaseUrl,
        paginateRest,
      }),
    }) as unknown as AppType;
  } catch (error) {
    console.error("Error initializing GitHub App:", error);
    return {
      octokit: { request: async () => ({ data: { id: 0 } }) },
      getInstallationOctokit: async () => ({}),
    } as any;
  }
}

export async function useOctokitInstallation(
  event: H3Event,
  owner: string,
  repo: string,
) {
  const app = useOctokitApp(event);
  const { data: installationData } = await app.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    { owner, repo },
  );

  return app.getInstallationOctokit(installationData.id);
}
