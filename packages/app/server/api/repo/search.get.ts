import stringSimilarity from "string-similarity";
import { z } from "zod";
import { useBucket } from "../../utils/bucket";
import { useOctokitApp } from "../../utils/octokit";

const querySchema = z.object({
  text: z.string(),
});

const REPO_INDEX_CACHE_KEY = "repo-search:index";
const REPO_INDEX_CACHE_TTL_MS = 5 * 60 * 1000;

interface RepoSearchIndexItem {
  id: number;
  name: string;
  ownerLogin: string;
  ownerAvatarUrl: string;
  stars: number;
}

interface RepoSearchIndexCache {
  fetchedAt: number;
  repos: RepoSearchIndexItem[];
}

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, (data) =>
    querySchema.parse(data),
  );
  if (!query.text) {
    return { nodes: [] };
  }

  const { signal } = toWebRequest(event);
  const searchText = query.text.toLowerCase();
  const app = useOctokitApp(event);
  const bucket = useBucket(event);

  const fetchInstalledRepos = async () => {
    const seen = new Set<number>();
    const repos: RepoSearchIndexItem[] = [];

    for await (const { installation } of app.eachInstallation.iterator()) {
      if (signal.aborted) {
        break;
      }

      try {
        const octokit = await app.getInstallationOctokit(installation.id);
        let page = 1;

        while (true) {
          const { data } = await octokit.request(
            "GET /installation/repositories",
            {
              page,
              per_page: 100,
            },
          );

          for (const repo of data.repositories) {
            if (repo.private || seen.has(repo.id)) {
              continue;
            }
            seen.add(repo.id);
            repos.push({
              id: repo.id,
              name: repo.name,
              ownerLogin: repo.owner.login,
              ownerAvatarUrl: repo.owner.avatar_url,
              stars: repo.stargazers_count || 0,
            });
          }

          if (data.repositories.length < 100) {
            break;
          }
          page += 1;
        }
      } catch {
        // Skip suspended installations
      }
    }

    return repos;
  };

  const getIndexedRepos = async () => {
    const now = Date.now();
    const cached =
      await bucket.getItem<RepoSearchIndexCache>(REPO_INDEX_CACHE_KEY);

    if (cached && now - cached.fetchedAt < REPO_INDEX_CACHE_TTL_MS) {
      return {
        repos: cached.repos,
        cacheStatus: "hit" as const,
      };
    }

    const repos = await fetchInstalledRepos();
    if (!signal.aborted) {
      await bucket.setItem(REPO_INDEX_CACHE_KEY, {
        fetchedAt: now,
        repos,
      });
    }

    return {
      repos,
      cacheStatus: "miss" as const,
    };
  };

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const stream = new ReadableStream<string>({
    async start(controller) {
      const send = (data: string) => {
        controller.enqueue(`data: ${data}\n\n`);
      };

      try {
        const { repos, cacheStatus } = await getIndexedRepos();
        setResponseHeader(event, "x-repo-index-cache", cacheStatus);
        const matches = repos
          .map((repo) => {
            const name = repo.name.toLowerCase();
            const owner = repo.ownerLogin.toLowerCase();
            const score = Math.max(
              stringSimilarity.compareTwoStrings(name, searchText),
              stringSimilarity.compareTwoStrings(owner, searchText),
            );

            if (
              score <= 0.3 &&
              !name.includes(searchText) &&
              !owner.includes(searchText)
            ) {
              return null;
            }

            return {
              ...repo,
              score,
            };
          })
          .filter(
            (repo): repo is RepoSearchIndexItem & { score: number } => !!repo,
          )
          .sort((a, b) => b.score - a.score || b.stars - a.stars);

        for (const repo of matches) {
          if (signal.aborted) {
            break;
          }
          send(
            JSON.stringify({
              id: repo.id,
              name: repo.name,
              owner: {
                login: repo.ownerLogin,
                avatarUrl: repo.ownerAvatarUrl,
              },
              stars: repo.stars,
            }),
          );
        }

        send("[DONE]");
      } catch (err) {
        send(JSON.stringify({ error: (err as Error).message }));
      } finally {
        controller.close();
      }
    },
  });

  return stream.pipeThrough(new TextEncoderStream());
});
