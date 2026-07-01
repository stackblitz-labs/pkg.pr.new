import type { H3Event } from "h3";
import { useBinding, usePackagesBucket } from "./bucket";

export interface RepoReleaseRow {
  sha: string;
  uploadedAt: number;
  packages: string[];
}

const getRepoReleaseRowsCached = defineCachedFunction(
  async (
    owner: string,
    repo: string,
    event: H3Event,
  ): Promise<RepoReleaseRow[]> => {
    const binding = useBinding(event as Parameters<typeof useBinding>[0]);
    const prefix = `${usePackagesBucket.base}:${owner}:${repo}:`;
    const rows = new Map<
      string,
      { uploadedAt: number; packages: Set<string> }
    >();
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

        const packageName = packageNameParts.join("/");
        const uploadedAt = new Date(object.uploaded).getTime();
        const row = rows.get(sha);

        if (row) {
          row.packages.add(packageName);
          row.uploadedAt = Math.max(row.uploadedAt, uploadedAt);
        } else {
          rows.set(sha, {
            uploadedAt,
            packages: new Set([packageName]),
          });
        }
      }

      listCursor = response.truncated ? response.cursor : undefined;
    } while (listCursor);

    return [...rows.entries()].map(([sha, value]) => ({
      sha,
      uploadedAt: value.uploadedAt,
      packages: [...value.packages],
    }));
  },
  {
    name: "repoReleaseRows",
    getKey: (owner: string, repo: string, _event?: H3Event) =>
      `${owner}/${repo}`,
    maxAge: 60 * 5,
    swr: true,
  },
);

export async function getRepoReleaseRows(
  event: H3Event,
  owner: string,
  repo: string,
) {
  return getRepoReleaseRowsCached(owner, repo, event);
}
