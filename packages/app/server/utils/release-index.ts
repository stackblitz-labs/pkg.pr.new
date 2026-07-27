import type { H3EventContext } from "h3";
import { joinKeys } from "unstorage";
import { useBinding, usePackagesBucket } from "./bucket";

interface Event {
  context: { cloudflare: H3EventContext["cloudflare"] };
}

export interface ReleaseIndexEntry {
  sha: string;
  uploadedAt: number;
  packages: string[];
}

export interface ReleaseIndexPage {
  items: ReleaseIndexEntry[];
  totalCount: number;
  hasNextPage: boolean;
}

interface BackfillMeta {
  version: number;
  at: number;
  count: number;
}

const BACKFILL_VERSION = 1;

const TS_WIDTH = 16;
const TS_MAX = 10 ** TS_WIDTH - 1;

export const useReleaseIndexBucket = {
  key: "release-index",
  get base() {
    return joinKeys("bucket", this.key);
  },
};

export const useReleaseShaBucket = {
  key: "release-sha",
  get base() {
    return joinKeys("bucket", this.key);
  },
};

export const useReleaseCountBucket = {
  key: "release-count",
  get base() {
    return joinKeys("bucket", this.key);
  },
};

export const useReleaseBackfillBucket = {
  key: "release-backfill",
  get base() {
    return joinKeys("bucket", this.key);
  },
};

function invertTimestamp(uploadedAt: number): string {
  const inverted = Math.max(0, TS_MAX - Math.trunc(uploadedAt));
  return String(inverted).padStart(TS_WIDTH, "0");
}

function indexPrefix(owner: string, repo: string): string {
  return `${useReleaseIndexBucket.base}:${owner}:${repo}:`;
}

function shaPrefix(owner: string, repo: string): string {
  return `${useReleaseShaBucket.base}:${owner}:${repo}:`;
}

function indexObjectKey(
  owner: string,
  repo: string,
  uploadedAt: number,
  sha: string,
): string {
  return `${indexPrefix(owner, repo)}${invertTimestamp(uploadedAt)}:${sha}`;
}

function shaPointerKey(owner: string, repo: string, sha: string): string {
  return `${shaPrefix(owner, repo)}${sha}`;
}

function countKey(owner: string, repo: string): string {
  return `${useReleaseCountBucket.base}:${owner}:${repo}`;
}

function backfillKey(owner: string, repo: string): string {
  return `${useReleaseBackfillBucket.base}:${owner}:${repo}`;
}

async function readJson<T>(binding: R2Bucket, key: string): Promise<T | null> {
  const obj = await binding.get(key);
  if (!obj) return null;
  try {
    return JSON.parse(await obj.text()) as T;
  } catch {
    return null;
  }
}

async function putJson(
  binding: R2Bucket,
  key: string,
  value: unknown,
): Promise<void> {
  await binding.put(key, JSON.stringify(value), {
    httpMetadata: { contentType: "application/json" },
  });
}

async function deletePrefix(binding: R2Bucket, prefix: string): Promise<void> {
  let listCursor: string | undefined;
  do {
    const response = await binding.list({
      cursor: listCursor,
      limit: 1000,
      prefix,
    } as any);
    if (response.objects.length > 0) {
      await Promise.all(
        response.objects.map((object: { key: string }) =>
          binding.delete(object.key),
        ),
      );
    }
    listCursor = response.truncated ? response.cursor : undefined;
  } while (listCursor);
}

export async function upsertReleaseIndexEntry(
  event: Event,
  owner: string,
  repo: string,
  entry: ReleaseIndexEntry,
): Promise<void> {
  const binding = useBinding(event);
  const pointerKey = shaPointerKey(owner, repo, entry.sha);
  const existing = await readJson<ReleaseIndexEntry>(binding, pointerKey);

  const newKey = indexObjectKey(owner, repo, entry.uploadedAt, entry.sha);
  const packages = [...new Set(entry.packages)].sort();
  const payload: ReleaseIndexEntry = {
    sha: entry.sha,
    uploadedAt: entry.uploadedAt,
    packages,
  };

  if (existing) {
    const oldKey = indexObjectKey(
      owner,
      repo,
      existing.uploadedAt,
      existing.sha,
    );
    if (oldKey !== newKey) {
      try {
        await binding.delete(oldKey);
      } catch {
        // ignore stale key cleanup failures
      }
    }
  } else {
    const current = await getReleaseCount(event, owner, repo);
    await putJson(binding, countKey(owner, repo), current + 1);
  }

  await putJson(binding, newKey, payload);
  await putJson(binding, pointerKey, payload);
}

export async function getReleaseCount(
  event: Event,
  owner: string,
  repo: string,
): Promise<number> {
  const binding = useBinding(event);
  const value = await readJson<number>(binding, countKey(owner, repo));
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function getReleaseIndexEntryBySha(
  event: Event,
  owner: string,
  repo: string,
  sha: string,
): Promise<ReleaseIndexEntry | null> {
  const binding = useBinding(event);
  return readJson<ReleaseIndexEntry>(binding, shaPointerKey(owner, repo, sha));
}

async function isBackfillComplete(
  event: Event,
  owner: string,
  repo: string,
): Promise<boolean> {
  const binding = useBinding(event);
  const meta = await readJson<BackfillMeta>(binding, backfillKey(owner, repo));
  return meta?.version === BACKFILL_VERSION;
}

export async function ensureReleaseIndexBackfilled(
  event: Event,
  owner: string,
  repo: string,
): Promise<void> {
  if (await isBackfillComplete(event, owner, repo)) {
    return;
  }

  const binding = useBinding(event);
  const prefix = `${usePackagesBucket.base}:${owner}:${repo}:`;
  const rows = new Map<string, { uploadedAt: number; packages: Set<string> }>();
  let listCursor: string | undefined;

  do {
    const response = await binding.list({
      cursor: listCursor,
      limit: 1000,
      prefix,
    } as any);

    for (const object of response.objects) {
      const trimmed = object.key.slice(prefix.length);
      const [sha, ...packageNameParts] = trimmed.split(":");
      if (!sha || packageNameParts.length === 0) continue;

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

  // drop any partial index left by publishes before backfill finished
  await deletePrefix(binding, indexPrefix(owner, repo));
  await deletePrefix(binding, shaPrefix(owner, repo));

  const entries = [...rows.entries()];
  const batchSize = 25;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async ([sha, value]) => {
        const payload: ReleaseIndexEntry = {
          sha,
          uploadedAt: value.uploadedAt,
          packages: [...value.packages].sort(),
        };
        await putJson(
          binding,
          indexObjectKey(owner, repo, payload.uploadedAt, sha),
          payload,
        );
        await putJson(binding, shaPointerKey(owner, repo, sha), payload);
      }),
    );
  }

  await putJson(binding, countKey(owner, repo), rows.size);
  await putJson(binding, backfillKey(owner, repo), {
    version: BACKFILL_VERSION,
    at: Date.now(),
    count: rows.size,
  } satisfies BackfillMeta);
}

export async function listReleaseIndexPage(
  event: Event,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
): Promise<ReleaseIndexPage> {
  await ensureReleaseIndexBackfilled(event, owner, repo);

  const binding = useBinding(event);
  const prefix = indexPrefix(owner, repo);
  const totalCount = await getReleaseCount(event, owner, repo);
  const safePage = Math.max(1, page);
  const safePerPage = Math.max(1, perPage);
  const skip = (safePage - 1) * safePerPage;

  const items: ReleaseIndexEntry[] = [];
  let skipped = 0;
  let listCursor: string | undefined;

  while (items.length < safePerPage) {
    const remainingSkip = Math.max(0, skip - skipped);
    const limit = Math.min(1000, remainingSkip + (safePerPage - items.length));
    const response = await binding.list({
      cursor: listCursor,
      limit,
      prefix,
    } as any);

    for (const object of response.objects) {
      if (skipped < skip) {
        skipped += 1;
        continue;
      }

      const entry = await readJson<ReleaseIndexEntry>(binding, object.key);
      if (entry?.sha) {
        items.push({
          sha: entry.sha,
          uploadedAt: entry.uploadedAt,
          packages: entry.packages ?? [],
        });
      }

      if (items.length >= safePerPage) {
        break;
      }
    }

    if (!response.truncated || items.length >= safePerPage) {
      break;
    }
    listCursor = response.cursor;
  }

  let hasNextPage = skip + items.length < totalCount;
  if (!hasNextPage && items.length === safePerPage) {
    const peek = await binding.list({
      prefix,
      limit: Math.min(1000, skip + safePerPage + 1),
    } as any);
    hasNextPage = peek.objects.length > skip + safePerPage;
  }

  return {
    items,
    totalCount:
      totalCount > 0 ? totalCount : skip + items.length + (hasNextPage ? 1 : 0),
    hasNextPage,
  };
}
