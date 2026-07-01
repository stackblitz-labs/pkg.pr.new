import type { H3Event } from "h3";
import { z } from "zod";
import { generatePublishUrl } from "../../utils/markdown";
import { useCursorsBucket } from "../../utils/bucket";
import { useOctokitInstallation } from "../../utils/octokit";
import { getRepoReleaseRows } from "../../utils/repo-releases";

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
    try {
      const url = `https://registry.npmjs.org/${encodePackageNameForUrl(packageName)}`;
      const res = await fetch(url, { method: "HEAD" });
      return res.ok;
    } catch (err) {
      console.error(`[isPackageOnNpm] check failed for ${packageName}:`, err);
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

interface CommitMeta {
  message: string | null;
  branch: string | null;
}

const getCommitMetaCached = defineCachedFunction(
  async (
    owner: string,
    repo: string,
    sha: string,
    installation: Awaited<ReturnType<typeof useOctokitInstallation>>,
  ): Promise<CommitMeta> => {
    let message: string | null = null;
    let branch: string | null = null;

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

    if (!branch) {
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
    }

    return { message, branch };
  },
  {
    name: "commitMeta",
    getKey: (owner: string, repo: string, sha: string) =>
      `${owner}/${repo}/${sha}`,
    maxAge: 60 * 60 * 24,
    swr: true,
  },
);

async function getCommitMetadata(
  installation: Awaited<ReturnType<typeof useOctokitInstallation>>,
  owner: string,
  repo: string,
  shas: string[],
) {
  const entries = await Promise.all(
    shas.map(async (sha) => {
      const meta = await getCommitMetaCached(owner, repo, sha, installation);
      return [sha, meta] as const;
    }),
  );
  return new Map(entries);
}

const getDefaultBranchCached = defineCachedFunction(
  async (
    owner: string,
    repo: string,
    installation: Awaited<ReturnType<typeof useOctokitInstallation>>,
  ): Promise<string> => {
    const { data } = await installation.rest.repos.get({ owner, repo });
    return data.default_branch;
  },
  {
    name: "defaultBranch",
    getKey: (owner: string, repo: string) => `${owner}/${repo}`,
    maxAge: 60 * 60,
    swr: true,
  },
);

async function getDefaultBranchInfo(
  event: H3Event,
  installation: Awaited<ReturnType<typeof useOctokitInstallation>>,
  owner: string,
  repo: string,
) {
  const defaultBranch = await getDefaultBranchCached(
    owner,
    repo,
    installation,
  );

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

export default defineCachedEventHandler(
  async (event) => {
    try {
      const query = await getValidatedQuery(event, (data) =>
        querySchema.parse(data),
      );

      const perPage = Number.parseInt(query.per_page, 10);
      const page = query.page
        ? Number.parseInt(query.page, 10)
        : query.cursor
          ? Number.parseInt(query.cursor, 10)
          : 1;

      const releaseRows = await getRepoReleaseRows(
        event,
        query.owner,
        query.repo,
      );

      const installation = await useOctokitInstallation(
        event,
        query.owner,
        query.repo,
      );
      const { pinnedSha, defaultBranch } = await getDefaultBranchInfo(
        event,
        installation,
        query.owner,
        query.repo,
      );

      // Server-side ordering guarantees pagination consistency.
      const releases = releaseRows
        .map((row) => ({ ...row, packages: new Set(row.packages) }))
        .sort((a, b) => {
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

      setHeader(
        event,
        "CDN-Cache-Control",
        "public, max-age=300, stale-while-revalidate=3600",
      );

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
  },
  {
    name: "api-repo-commits",
    getKey: (event) => {
      const q = getQuery(event) as Record<string, string | undefined>;
      const owner = q.owner ?? "";
      const repo = q.repo ?? "";
      const page = q.page ?? q.cursor ?? "1";
      const perPage = q.per_page ?? "10";
      return `${owner}:${repo}:${page}:${perPage}`;
    },
    maxAge: 60 * 2,
    swr: true,
    staleMaxAge: 60 * 30,
  },
);
