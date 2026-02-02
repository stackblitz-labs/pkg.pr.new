import stringSimilarity from "string-similarity";
import { z } from "zod";
import { useOctokitApp } from "../../utils/octokit";

const querySchema = z.object({
  text: z.string(),
});

const INSTALLATION_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedRepos {
  fetchedAt: number;
  repos: Array<{
    id: number;
    name: string;
    private: boolean;
    owner: { login: string; avatar_url: string };
    stargazers_count?: number;
  }>;
}

const installationRepoCache = new Map<number, CachedRepos>();

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, (data) =>
    querySchema.parse(data),
  );

  if (!query.text) {
    return { nodes: [] };
  }

  const { signal } = toWebRequest(event);

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const app = useOctokitApp(event);
  const searchText = query.text.toLowerCase();

  async function getInstallationRepos(installationId: number) {
    const cached = installationRepoCache.get(installationId);
    const now = Date.now();

    if (cached && now - cached.fetchedAt < INSTALLATION_CACHE_TTL_MS) {
      return cached.repos;
    }

    try {
      const octokit = await app.getInstallationOctokit(installationId);
      const { data } = await octokit.request("GET /installation/repositories", {
        per_page: 100,
      });
      installationRepoCache.set(installationId, {
        fetchedAt: now,
        repos: data.repositories,
      });
      return data.repositories;
    } catch {
      if (cached) {
        return cached.repos;
      }
      throw new Error("Unable to load repositories");
    }
  }

  async function* iterateMatches() {
    const seen = new Set<number>();

    for await (const { installation } of app.eachInstallation.iterator()) {
      if (signal.aborted) {
        return;
      }

      try {
        const repos = await getInstallationRepos(installation.id);

        for (const repo of repos) {
          if (repo.private || seen.has(repo.id)) {
            continue;
          }

          const name = repo.name.toLowerCase();
          const owner = repo.owner.login.toLowerCase();
          const score = Math.max(
            stringSimilarity.compareTwoStrings(name, searchText),
            stringSimilarity.compareTwoStrings(owner, searchText),
          );

          if (
            score > 0.3 ||
            name.includes(searchText) ||
            owner.includes(searchText)
          ) {
            seen.add(repo.id);
            yield JSON.stringify({
              id: repo.id,
              name: repo.name,
              owner: {
                login: repo.owner.login,
                avatarUrl: repo.owner.avatar_url,
              },
              stars: repo.stargazers_count || 0,
            });
          }
        }
      } catch {
        // Skip suspended installations
      }
    }

    yield "[DONE]";
  }

  const stream = new ReadableStream<string>({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(`data: ${data}\n\n`);
      };

      try {
        for await (const match of iterateMatches()) {
          send(match);
        }
      } catch (err) {
        send(JSON.stringify({ error: (err as Error).message }));
      } finally {
        controller.close();
      }
    },
  });

  return stream.pipeThrough(new TextEncoderStream());
});
