import type { H3EventContext } from "h3";
import { joinKeys } from "unstorage";
import { useBinding, usePackagesBucket } from "./bucket";

interface Event {
  context: { cloudflare: H3EventContext["cloudflare"] };
  waitUntil?: (promise: Promise<unknown>) => void;
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
  indexReady: boolean;
}

interface BackfillMeta {
  version: number;
  at: number;
  count: number;
}

const BACKFILL_VERSION = 1;

const TS_WIDTH = 16;
const TS_MAX = Number.MAX_SAFE_INTEGER;
const BACKFILL_BATCH_SIZE = 25;

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

export const useReleaseStatusBucket = {
  key: "release-status",
  get base() {
    return joinKeys("bucket", this.key);
  },
};

export interface BackfillStatus {
  phase: "listing" | "writing" | "done" | "error";
  listedObjects: number;
  distinctShas: number;
  written: number;
  startedAt: number;
  updatedAt: number;
  error?: string;
}

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

function statusKey(owner: string, repo: string): string {
  return `${useReleaseStatusBucket.base}:${owner}:${repo}`;
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

async function putStatus(
  binding: R2Bucket,
  owner: string,
  repo: string,
  status: Omit<BackfillStatus, "updatedAt">,
): Promise<void> {
  await putJson(binding, statusKey(owner, repo), {
    ...status,
    updatedAt: Date.now(),
  } satisfies BackfillStatus);
}

export async function readBackfillStatus(
  event: Event,
  owner: string,
  repo: string,
): Promise<BackfillStatus | null> {
  const binding = useBinding(event);
  return readJson<BackfillStatus>(binding, statusKey(owner, repo));
}

/**
 * Best-effort upsert of one commit's release index entry.
 * Only deletes a prior *index* key for the same sha when the timestamp key changes.
 * Never touches `bucket:package:...` tarball objects.
 */
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

export async function isReleaseIndexReady(
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
  if (await isReleaseIndexReady(event, owner, repo)) {
    return;
  }

  const binding = useBinding(event);
  const startedAt = Date.now();
  const prefix = `${usePackagesBucket.base}:${owner}:${repo}:`;
  const rows = new Map<string, { uploadedAt: number; packages: Set<string> }>();
  let listCursor: string | undefined;
  let listedObjects = 0;

  try {
    await putStatus(binding, owner, repo, {
      phase: "listing",
      listedObjects: 0,
      distinctShas: 0,
      written: 0,
      startedAt,
    });

    do {
      const response = await binding.list({
        cursor: listCursor,
        limit: 1000,
        prefix,
      } as any);

      for (const object of response.objects) {
        listedObjects += 1;
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

    const entries = [...rows.entries()];
    await putStatus(binding, owner, repo, {
      phase: "writing",
      listedObjects,
      distinctShas: entries.length,
      written: 0,
      startedAt,
    });

    let written = 0;
    for (let i = 0; i < entries.length; i += BACKFILL_BATCH_SIZE) {
      await Promise.all(
        entries.slice(i, i + BACKFILL_BATCH_SIZE).map(async ([sha, value]) => {
          const pointerKey = shaPointerKey(owner, repo, sha);
          const existing = await readJson<ReleaseIndexEntry>(
            binding,
            pointerKey,
          );
          const payload: ReleaseIndexEntry = {
            sha,
            uploadedAt: value.uploadedAt,
            packages: [...value.packages].sort(),
          };
          const newKey = indexObjectKey(owner, repo, payload.uploadedAt, sha);

          // Write the replacement before deleting stale index metadata.
          await Promise.all([
            putJson(binding, newKey, payload),
            putJson(binding, pointerKey, payload),
          ]);

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
                // ignore stale index key cleanup failures
              }
            }
          }
        }),
      );
      written = Math.min(entries.length, i + BACKFILL_BATCH_SIZE);
    }

    await putJson(binding, countKey(owner, repo), rows.size);
    await putJson(binding, backfillKey(owner, repo), {
      version: BACKFILL_VERSION,
      at: Date.now(),
      count: rows.size,
    } satisfies BackfillMeta);

    await putStatus(binding, owner, repo, {
      phase: "done",
      listedObjects,
      distinctShas: entries.length,
      written,
      startedAt,
    });
  } catch (error) {
    await putStatus(binding, owner, repo, {
      phase: "error",
      listedObjects,
      distinctShas: rows.size,
      written: 0,
      startedAt,
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => {});
    throw error;
  }
}

/**
 * Start historical indexing without adding it to request latency.
 * The work is idempotent; the marker is written only after a complete rebuild.
 */
export async function scheduleReleaseIndexBackfill(
  event: Event,
  owner: string,
  repo: string,
): Promise<boolean> {
  if (await isReleaseIndexReady(event, owner, repo)) {
    return true;
  }

  const task = ensureReleaseIndexBackfilled(event, owner, repo).catch(
    (error) => {
      console.error(
        `[release-index] backfill failed for ${owner}/${repo}:`,
        error,
      );
    },
  );

  if (typeof event.waitUntil === "function") {
    event.waitUntil(task);
  } else {
    void task;
  }

  return false;
}

export async function listReleaseIndexPage(
  event: Event,
  owner: string,
  repo: string,
  page: number,
  perPage: number,
): Promise<ReleaseIndexPage> {
  const indexReady = await scheduleReleaseIndexBackfill(event, owner, repo);

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
    indexReady,
  };
}
