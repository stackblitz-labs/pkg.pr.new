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

async function getCommitMessages(
  installation: Awaited<ReturnType<typeof useOctokitInstallation>>,
  owner: string,
  repo: string,
  shas: string[],
) {
  async function fetchCommitTitle(sha: string) {
    try {
      const { data } = await installation.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });
      const message = data.commit?.message?.split("\n")[0]?.trim();
      if (message) {
        return message;
      }
    } catch {
      return null;
    }

    return null;
  }

  const entries = await Promise.all(
    shas.map(async (sha) => {
      const message = await fetchCommitTitle(sha);
      return message ? ([sha, message] as const) : null;
    }),
  );

  return new Map(
    entries.filter((entry): entry is readonly [string, string] => !!entry),
  );
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
    const commitMessages = await getCommitMessages(
      installation,
      query.owner,
      query.repo,
      pageItems.map((row) => row.sha),
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
            const commitTitle = commitMessages.get(row.sha);
            return {
              id: row.sha,
              oid: row.sha,
              abbreviatedOid,
              message: commitTitle ?? row.sha,
              unverified: !commitTitle,
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
