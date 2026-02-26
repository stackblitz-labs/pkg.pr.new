import type { H3Event } from "h3";
import type { App as AppType } from "octokit";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { App, Octokit } from "octokit";

function createNoopApp(): AppType {
  return {
    octokit: { request: async () => ({ data: { id: 0 } }) },
    eachInstallation: {
      iterator: async function* () {
        // no-op: no installations available
      },
    },
    getInstallationOctokit: async () =>
      ({
        request: async () => ({ data: {} }),
        paginate: { iterator: null },
        rest: {
          repos: {
            get: async () => ({ data: { default_branch: "main" } }),
            getCommit: async () => ({ data: { commit: { message: "" } } }),
          },
        },
      }) as any,
    webhooks: {
      on: () => {},
      removeListener: () => {},
      receive: async () => {},
      verifyAndReceive: async () => {},
    },
    log: {
      error: (...args: unknown[]) => console.error(...args),
    },
  } as any;
}

export function useOctokitApp(event: H3Event): AppType {
  try {
    const config = useRuntimeConfig(event);
    const { appId, privateKey, webhookSecret, ghBaseUrl } = config;

    if (!appId || !privateKey || !webhookSecret) {
      console.warn("Missing required GitHub App credentials in runtime config");
      return createNoopApp();
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
    return createNoopApp();
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
