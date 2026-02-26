import type { H3Event } from "h3";
import { z } from "zod";
import type { PackageManager } from "@pkg-pr-new/utils";
import { generateCommitPublishMessage } from "../../utils/markdown";
import {
  useBinding,
  useCursorsBucket,
  usePackagesBucket,
} from "../../utils/bucket";
import { useOctokitInstallation } from "../../utils/octokit";

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
  async function fetchCommitMeta(sha: string): Promise<CommitMeta> {
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

  return new Map(entries);
}

async function getDefaultBranchPinnedSha(
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
  return cursor?.sha ?? null;
}

function makeReleaseText(
  origin: string,
  owner: string,
  repo: string,
  sha: string,
  packages: string[],
) {
  return generateCommitPublishMessage(
    origin,
    {},
    packages,
    {
      owner,
      repo,
      sha,
      ref: sha,
    },
    false,
    "npm" satisfies PackageManager,
    false,
    false,
  ).trim();
}

export default defineEventHandler(async (event) => {
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

    const binding = useBinding(event as Parameters<typeof useBinding>[0]);
    const prefix = `${usePackagesBucket.base}:${query.owner}:${query.repo}:`;
    const rows = new Map<string, ReleaseRow>();
    let listCursor: string | undefined;

    do {
      const response = await binding.list({
        cursor: listCursor,
        limit: 1000,
        prefix,
      } as any);

      for (const object of response.objects) {
        const key = object.key;
        const trimmed = key.slice(prefix.length);
        const [sha, ...packageNameParts] = trimmed.split(":");
        if (!sha || packageNameParts.length === 0) {
          continue;
        }
        const packageName = packageNameParts.join(":");
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

    const installation = await useOctokitInstallation(
      event,
      query.owner,
      query.repo,
    );
    const pinnedSha = await getDefaultBranchPinnedSha(
      event,
      installation,
      query.owner,
      query.repo,
    );

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
    const origin = getRequestURL(event).origin;
    const commitMetadata = await getCommitMetadata(
      installation,
      query.owner,
      query.repo,
      pageItems.map((row) => row.sha),
    );

    setHeader(
      event,
      "Cache-Control",
      "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
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
            return {
              id: row.sha,
              oid: row.sha,
              abbreviatedOid,
              message: commitTitle ?? row.sha,
              unverified: !commitTitle,
              branch: meta?.branch ?? null,
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
                      text: makeReleaseText(
                        origin,
                        query.owner,
                        query.repo,
                        row.sha,
                        sortedPackages,
                      ),
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
