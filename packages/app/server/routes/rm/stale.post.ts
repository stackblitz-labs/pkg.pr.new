import type { H3Event } from "h3";

export default eventHandler(async (event) => {
  const rmStaleKeyHeader = getHeader(event, "sb-rm-stale-key");
  const signal = toWebRequest(event).signal;
  const { rmStaleKey } = useRuntimeConfig(event);

  if (rmStaleKeyHeader !== rmStaleKey) {
    throw createError({
      status: 403,
    });
  }

  const { bucket, startAfter, remove } = await readBody<{ bucket: 'packages' | 'templates'; startAfter: string | null; remove: boolean }>(event);

  setResponseHeader(event, "Content-Type", "application/json");

  const result = await iterateAndDelete(event, signal, {
    prefix: bucket === 'packages' ? usePackagesBucket.base : useTemplatesBucket.base,
    startAfter: startAfter || undefined,
  }, remove);

  return result;
});

// Helper for concurrency limiting
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await fn(items[currentIndex], currentIndex);
    }
  }

  const workers = Array(Math.min(concurrency, items.length))
    .fill(0)
    .map(() => worker());

  await Promise.all(workers);
  return results;
}

async function iterateAndDelete(event: H3Event, signal: AbortSignal, opts: R2ListOptions & { startAfter?: string }, remove: boolean) {
  const binding = useBinding(event);
  let truncated = true;
  let startAfter: string | undefined = opts.startAfter;
  const removedItems: Array<{ key: string; uploaded: Date; downloadedAt?: Date }> = [];
  const downloadedAtBucket = useDownloadedAtBucket(event);
  const today = Date.parse(new Date().toString());
  const CONCURRENCY = 10;

  const next = await binding.list({
    ...opts,
    limit: 1000,
    startAfter,
  });

  let lastNonRemovedKey: string | undefined = undefined;
  await mapWithConcurrency(next.objects, CONCURRENCY, async (object) => {
    if (signal.aborted) return;
    const uploaded = Date.parse(object.uploaded.toString());
    const uploadedDate = new Date(uploaded);
    const sixMonthsAgo = new Date(today);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (uploadedDate <= sixMonthsAgo) {
      removedItems.push({
        key: object.key,
        uploaded: new Date(object.uploaded),
      });
      if (remove) {
        await binding.delete(object.key);
        await downloadedAtBucket.removeItem(object.key);
      }
      return;
    }
    const downloadedAt = await downloadedAtBucket.getItem(object.key);
    if (!downloadedAt) {
      lastNonRemovedKey = object.key;
      return;
    }
    const downloadedAtDate = new Date(downloadedAt);
    const oneMonthAgo = new Date(today);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const uploadedDate2 = new Date(uploaded);
    if (
      downloadedAtDate <= oneMonthAgo &&
      uploadedDate2 <= oneMonthAgo
    ) {
      removedItems.push({
        key: object.key,
        uploaded: new Date(object.uploaded),
        downloadedAt: new Date(downloadedAt),
      });
      if (remove) {
        await binding.delete(object.key);
        await downloadedAtBucket.removeItem(object.key);
      }
    } else {
      lastNonRemovedKey = object.key;
    }
  });

  truncated = next.truncated;
  if (next.truncated && lastNonRemovedKey) {
    startAfter = lastNonRemovedKey;
  }

  return {
    startAfter,
    truncated,
    removedItems,
  };
}


