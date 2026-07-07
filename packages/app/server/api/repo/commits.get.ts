import type { H3Event } from "h3";
import { z } from "zod";
import { generatePublishUrl } from "../../utils/markdown";
import {
  useBinding,
  useCursorsBucket,
  usePackagesBucket,
} from "../../utils/bucket";
import { useOctokitInstallation } from "../../utils/octokit";

function createTimer(label: string) {
  const start = Date.now();
  const marks: Array<{ name: string; ms: number }> = [];
  let last = start;
  return {
    mark(name: string, extra?: Record<string, unknown>) {
      const now = Date.now();
      const ms = now - last;
      last = now;
      marks.push({ name, ms, ...extra });
      console.log(`[commits.timing] ${label} ${name}=${ms}ms`, extra ?? "");
    },
    end(extra?: Record<string, unknown>) {
      const total = Date.now() - start;
      console.log(
        `[commits.timing] ${label} TOTAL=${total}ms`,
        JSON.stringify({ marks, ...extra }),
      );
      return total;
    },
  };
}

function encodePackageNameForUrl(packageName: string): string {
  if (packageName.startsWith("@")) {
    const slash = packageName.indexOf("/");
    if (slash > 0) {
      return `${packageName.slice(0, slash)}/${encodeURIComponent(packageName.slice(slash + 1))}`;
    }
  }
  return encodeURIComponent(packageName);
}

const isPackageOnNpm = defineCachedFunction(
  async (packageName: string): Promise<boolean> => {
    // This body only runs on a cache MISS, so it measures the real network cost.
    const start = Date.now();
    try {
      const url = `https://registry.npmjs.org/${encodePackageNameForUrl(packageName)}`;
      const res = await fetch(url, { method: "HEAD" });
      console.log(
        `[isPackageOnNpm.timing] MISS ${packageName}=${Date.now() - start}ms ok=${res.ok}`,
      );
      return res.ok;
    } catch (err) {
      console.error(
        `[isPackageOnNpm] check failed for ${packageName} after ${Date.now() - start}ms:`,
        err,
      );
      return false;
    }
  },
  {
    name: "isPackageOnNpm",
    getKey: (packageName: string) => packageName,
    maxAge: 60 * 60,
    swr: true,
  },
);

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
  cursor: z.string().optional(),
  page: z.string().optional(),
  per_page: z.string().optional().default("10"),
});

interface ReleaseRow {
  sha: string;
  uploadedAt: number;
  packages: Set<string>;
}

interface CommitMeta {
  message: string | null;
  branch: string | null;
}

async function getCommitMetadata(
  installation: Awaited<ReturnType<typeof useOctokitInstallation>>,
  owner: string,
  repo: string,
  shas: string[],
) {
  const githubTimings = {
    getCommit: { count: 0, totalMs: 0, maxMs: 0 },
    branchesWhereHead: { count: 0, totalMs: 0, maxMs: 0 },
    listPRs: { count: 0, totalMs: 0, maxMs: 0 },
  };

  function record(bucket: keyof typeof githubTimings, ms: number) {
    const b = githubTimings[bucket];
    b.count += 1;
    b.totalMs += ms;
    b.maxMs = Math.max(b.maxMs, ms);
  }

  async function fetchCommitMeta(sha: string): Promise<CommitMeta> {
    let message: string | null = null;
    let branch: string | null = null;

    let t = Date.now();
    try {
      const { data } = await installation.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });
      const rawMessage = data.commit?.message?.trim();
      const title = rawMessage?.split("\n")[0]?.trim();
      if (title) {
        message = title;
      }
    } catch {}
    record("getCommit", Date.now() - t);

    t = Date.now();
    try {
      const { data } = await installation.request(
        "GET /repos/{owner}/{repo}/commits/{commit_sha}/branches-where-head",
        {
          owner,
          repo,
          commit_sha: sha,
        },
      );
      const branchName = (data as Array<{ name?: string }>)[0]?.name?.trim();
      if (branchName) {
        branch = branchName;
      }
    } catch {}
    record("branchesWhereHead", Date.now() - t);

    if (!branch) {
      t = Date.now();
      try {
        const { data } =
          await installation.rest.repos.listPullRequestsAssociatedWithCommit({
            owner,
            repo,
            commit_sha: sha,
          });
        const prBranch = data
          .slice()
          .sort(
            (a, b) =>
              new Date(b.updated_at ?? 0).getTime() -
              new Date(a.updated_at ?? 0).getTime(),
          )[0]?.head?.ref;
        if (prBranch?.trim()) {
          branch = prBranch.trim();
        }
      } catch {}
      record("listPRs", Date.now() - t);
    }

    return {
      message,
      branch,
    };
  }

  const entries = await Promise.all(
    shas.map(async (sha) => {
      const meta = await fetchCommitMeta(sha);
      return [sha, meta] as const;
    }),
  );

  console.log(
    `[commits.timing] ${owner}/${repo} github-calls`,
    JSON.stringify(githubTimings),
  );

  return new Map(entries);
}

async function getDefaultBranchInfo(
  event: H3Event,
  installation: Awaited<ReturnType<typeof useOctokitInstallation>>,
  owner: string,
  repo: string,
) {
  const {
    data: { default_branch: defaultBranch },
  } = await installation.rest.repos.get({
    owner,
    repo,
  });

  const cursorBucket = useCursorsBucket(
    event as Parameters<typeof useCursorsBucket>[0],
  );
  const cursor = await cursorBucket.getItem(
    `${owner}:${repo}:${defaultBranch}`,
  );
  return {
    defaultBranch,
    pinnedSha: cursor?.sha ?? null,
  };
}

function buildPackageInfo(
  origin: string,
  owner: string,
  repo: string,
  sha: string,
  packageName: string,
  onNpm: boolean,
) {
  const installUrl = generatePublishUrl(
    "sha",
    origin,
    packageName,
    { owner, repo, sha, ref: sha },
    false,
  );
  return {
    name: packageName,
    installUrl,
    installCommand: `npm i ${installUrl}`,
    isOnNpm: onNpm,
  };
}

export default defineEventHandler(async (event) => {
  try {
    const query = await getValidatedQuery(event, (data) =>
      querySchema.parse(data),
    );

    const timer = createTimer(`${query.owner}/${query.repo}`);

    const perPage = Number.parseInt(query.per_page, 10);
    const page = query.page
      ? Number.parseInt(query.page, 10)
      : query.cursor
        ? Number.parseInt(query.cursor, 10)
        : 1;

    const binding = useBinding(event as Parameters<typeof useBinding>[0]);
    const prefix = `${usePackagesBucket.base}:${query.owner}:${query.repo}:`;
    const rows = new Map<string, ReleaseRow>();
    let listCursor: string | undefined;
    let listPages = 0;
    let listObjects = 0;

    do {
      const response = await binding.list({
        cursor: listCursor,
        limit: 1000,
        prefix,
      } as any);

      listPages += 1;
      listObjects += response.objects.length;

      for (const object of response.objects) {
        const key = object.key;
        const trimmed = key.slice(prefix.length);
        const [sha, ...packageNameParts] = trimmed.split(":");
        if (!sha || packageNameParts.length === 0) {
          continue;
        }
        const packageName = packageNameParts.join("/");
        const uploadedAt = new Date(object.uploaded).getTime();

        const row = rows.get(sha);
        if (row) {
          row.packages.add(packageName);
          row.uploadedAt = Math.max(row.uploadedAt, uploadedAt);
        } else {
          rows.set(sha, {
            sha,
            uploadedAt,
            packages: new Set([packageName]),
          });
        }
      }

      listCursor = response.truncated ? response.cursor : undefined;
    } while (listCursor);

    timer.mark("r2-list", {
      pages: listPages,
      objects: listObjects,
      commits: rows.size,
    });

    const installation = await useOctokitInstallation(
      event,
      query.owner,
      query.repo,
    );
    timer.mark("octokit-installation");

    const { pinnedSha, defaultBranch } = await getDefaultBranchInfo(
      event,
      installation,
      query.owner,
      query.repo,
    );
    timer.mark("default-branch-info");

    // Server-side ordering guarantees pagination consistency.
    const releases = [...rows.values()].sort((a, b) => {
      if (pinnedSha) {
        if (a.sha === pinnedSha && b.sha !== pinnedSha) {
          return -1;
        }
        if (b.sha === pinnedSha && a.sha !== pinnedSha) {
          return 1;
        }
      }
      if (b.uploadedAt !== a.uploadedAt) {
        return b.uploadedAt - a.uploadedAt;
      }
      return b.sha.localeCompare(a.sha);
    });
    const start = Math.max(0, (page - 1) * perPage);
    const end = start + perPage;
    const pageItems = releases.slice(start, end);
    const hasNextPage = end < releases.length;
    const nextCursor = hasNextPage ? String(page + 1) : null;
    const totalCount = releases.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    const origin = import.meta.dev
      ? getRequestURL(event).origin
      : "https://pkg.pr.new";
    const commitMetadata = await getCommitMetadata(
      installation,
      query.owner,
      query.repo,
      pageItems.map((row) => row.sha),
    );
    timer.mark("commit-metadata", { commits: pageItems.length });

    const uniquePackages = new Set<string>();
    for (const row of pageItems) {
      for (const name of row.packages) uniquePackages.add(name);
    }
    const npmCheckResults = await Promise.all(
      [...uniquePackages].map(async (name) => {
        try {
          return [name, await isPackageOnNpm(name)] as const;
        } catch {
          return [name, false] as const;
        }
      }),
    );
    const packagesOnNpm = new Set<string>(
      npmCheckResults.filter(([, ok]) => ok).map(([name]) => name),
    );
    timer.mark("npm-checks", { packages: uniquePackages.size });

    setHeader(
      event,
      "Cache-Control",
      "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
    );

    timer.end({
      page,
      perPage,
      totalCommits: releases.length,
      returnedCommits: pageItems.length,
    });

    return {
      id: `releases-${query.owner}-${query.repo}`,
      name: "all refs",
      target: {
        id: `releases-target-${query.owner}-${query.repo}`,
        history: {
          nodes: pageItems.map((row) => {
            const abbreviatedOid = row.sha.slice(0, 7);
            const sortedPackages = [...row.packages].sort();
            const meta = commitMetadata.get(row.sha);
            const commitTitle = meta?.message ?? null;
            const pinned = pinnedSha === row.sha;
            const packages = sortedPackages.map((name) =>
              buildPackageInfo(
                origin,
                query.owner,
                query.repo,
                row.sha,
                name,
                packagesOnNpm.has(name),
              ),
            );
            return {
              id: row.sha,
              oid: row.sha,
              abbreviatedOid,
              message: commitTitle ?? row.sha,
              unverified: !commitTitle,
              pinned,
              branch: pinned ? defaultBranch : (meta?.branch ?? null),
              authoredDate: new Date(row.uploadedAt).toISOString(),
              url: `https://github.com/${query.owner}/${query.repo}/commit/${row.sha}`,
              statusCheckRollup: {
                id: `status-${row.sha}`,
                state: "SUCCESS",
                contexts: {
                  nodes: [
                    {
                      id: `release-${row.sha}`,
                      status: "completed",
                      name: "Continuous Releases",
                      title: "Continuous Releases",
                      summary: `Published ${sortedPackages.length} package(s)`,
                      packages,
                      detailsUrl: `https://github.com/${query.owner}/${query.repo}/commit/${row.sha}`,
                      url: `https://github.com/${query.owner}/${query.repo}/commit/${row.sha}`,
                    },
                  ],
                },
              },
            };
          }),
          pageInfo: {
            hasNextPage,
            endCursor: nextCursor,
            currentPage: page,
            perPage,
            totalCount,
            totalPages,
          },
        },
      },
    };
  } catch (error) {
    console.error("Error fetching repository releases:", error);

    return {
      id: "error",
      name: "error",
      error: true,
      message: (error as Error).message,
      target: {
        id: "error-target",
        history: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
    };
  }
});
