import type { H3Event } from "h3";
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

type CacheStatus = "hit" | "stale" | "miss";

let revalidateRepoIndexPromise: Promise<void> | null = null;

async function fetchInstalledRepos(event: H3Event) {
  const app = useOctokitApp(event);
  const seen = new Set<number>();
  const repos: RepoSearchIndexItem[] = [];

  for await (const { installation } of app.eachInstallation.iterator()) {
    try {
      const octokit = await app.getInstallationOctokit(installation.id);
      const installationRepos = await octokit.paginate(
        "GET /installation/repositories",
        { per_page: 100 },
        (response) => response.data.repositories,
      );

      for (const repo of installationRepos) {
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
    } catch {
      // Skip suspended installations
    }
  }

  return repos;
}

async function revalidateRepoIndex(event: H3Event) {
  if (revalidateRepoIndexPromise) {
    return revalidateRepoIndexPromise;
  }

  revalidateRepoIndexPromise = (async () => {
    const bucket = useBucket(event);
    const repos = await fetchInstalledRepos(event);

    await bucket.setItem(REPO_INDEX_CACHE_KEY, {
      fetchedAt: Date.now(),
      repos,
    });
  })().finally(() => {
    revalidateRepoIndexPromise = null;
  });

  return revalidateRepoIndexPromise;
}

async function getIndexedRepos(event: H3Event): Promise<{
  repos: RepoSearchIndexItem[];
  cacheStatus: CacheStatus;
}> {
  const bucket = useBucket(event);
  const now = Date.now();
  const cached =
    await bucket.getItem<RepoSearchIndexCache>(REPO_INDEX_CACHE_KEY);

  if (cached && now - cached.fetchedAt < REPO_INDEX_CACHE_TTL_MS) {
    return { repos: cached.repos, cacheStatus: "hit" };
  }

  if (cached) {
    const refreshPromise = revalidateRepoIndex(event).catch((err) => {
      console.error("Failed to refresh repo index cache", err);
    });

    if (typeof event.waitUntil === "function") {
      event.waitUntil(refreshPromise);
    }

    return { repos: cached.repos, cacheStatus: "stale" };
  }

  const repos = await fetchInstalledRepos(event);
  await bucket.setItem(REPO_INDEX_CACHE_KEY, {
    fetchedAt: now,
    repos,
  });

  return { repos, cacheStatus: "miss" };
}

function findMatches(repos: RepoSearchIndexItem[], text: string) {
  const searchText = text.toLowerCase();

  return repos
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
        id: repo.id,
        name: repo.name,
        owner: {
          login: repo.ownerLogin,
          avatarUrl: repo.ownerAvatarUrl,
        },
        stars: repo.stars,
        score,
      };
    })
    .filter((repo): repo is NonNullable<typeof repo> => !!repo)
    .sort((a, b) => b.score - a.score || b.stars - a.stars)
    .map(({ score: _score, ...repo }) => repo);
}

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, (data) =>
    querySchema.parse(data),
  );

  if (!query.text) {
    return { nodes: [] };
  }

  const { repos, cacheStatus } = await getIndexedRepos(event);
  setResponseHeader(event, "x-repo-index-cache", cacheStatus);

  return {
    nodes: findMatches(repos, query.text),
  };
});
