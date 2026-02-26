import type { H3Event } from "h3";
import stringSimilarity from "string-similarity";
import { z } from "zod";
import { useBucket } from "../../utils/bucket";
import { useBinding, usePackagesBucket } from "../../utils/bucket";

const querySchema = z.object({
  text: z.string(),
});

const REPO_INDEX_CACHE_KEY = "repo-search:index";
const REPO_INDEX_CACHE_TTL_MS = 5 * 60 * 1000;

interface RepoSearchIndexItem {
  name: string;
  ownerLogin: string;
}

interface RepoSearchIndexCache {
  fetchedAt: number;
  repos: RepoSearchIndexItem[];
}

type CacheStatus = "hit" | "stale" | "miss";

let revalidateRepoIndexPromise: Promise<void> | null = null;

async function fetchInstalledRepos(event: H3Event) {
  const binding = useBinding(event as any);
  const seen = new Set<string>();
  const repos: RepoSearchIndexItem[] = [];
  const prefix = `${usePackagesBucket.base}:`;
  let cursor: string | undefined;

  do {
    const response = await binding.list({
      cursor,
      limit: 1000,
      prefix,
    } as any);

    for (const { key } of response.objects) {
      const trimmed = key.slice(prefix.length);
      const [owner, repo] = trimmed.split(":");
      if (!owner || !repo) {
        continue;
      }
      const fullName = `${owner}/${repo}`;
      if (seen.has(fullName)) {
        continue;
      }
      seen.add(fullName);
      repos.push({
        name: repo,
        ownerLogin: owner,
      });
    }

    cursor = response.truncated ? response.cursor : undefined;
  } while (cursor);

  return repos;
}

async function rebuildRepoIndex(event: H3Event) {
  const bucket = useBucket(event);
  const repos = await fetchInstalledRepos(event);

  await bucket.setItem(REPO_INDEX_CACHE_KEY, {
    fetchedAt: Date.now(),
    repos,
  });
}

async function revalidateRepoIndex(event: H3Event) {
  if (revalidateRepoIndexPromise) {
    return revalidateRepoIndexPromise;
  }

  revalidateRepoIndexPromise = rebuildRepoIndex(event).finally(() => {
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

  if (
    cached &&
    cached.repos.length > 0 &&
    now - cached.fetchedAt < REPO_INDEX_CACHE_TTL_MS
  ) {
    return { repos: cached.repos, cacheStatus: "hit" };
  }

  if (cached && cached.repos.length > 0) {
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
        id: `${repo.ownerLogin}/${repo.name}`,
        name: repo.name,
        owner: {
          login: repo.ownerLogin,
          avatarUrl: `https://github.com/${repo.ownerLogin}.png`,
        },
        stars: 0,
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
