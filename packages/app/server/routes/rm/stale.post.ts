import type { H3Event } from "h3";

export default eventHandler(async (event) => {
  const rmStaleKeyHeader = getHeader(event, "sb-rm-stale-key");
  const signal = toWebRequest(event).signal;
  const { rmStaleKey } = useRuntimeConfig(event);

  // if (rmStaleKeyHeader !== rmStaleKey) {
  //   throw createError({
  //     status: 403,
  //   });
  // }

  const { bucket, cursor, remove } = await readBody<{ bucket: 'packages' | 'templates'; cursor: string | null; remove: boolean }>(event);

  const result = await iterateAndDelete(event, signal, {
    prefix: bucket === 'packages' ? usePackagesBucket.base : useTemplatesBucket.base,
    limit: 1000,
    cursor: cursor || undefined,
  }, remove);

  setResponseHeader(event, "Content-Type", "application/json");

  return {
    result,
  };
});

// Helper for concurrency limiting
async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const executing: Promise<void>[] = [];

  async function enqueue(item: T) {
    const result = await fn(item);
    results.push(result);
  }

  while (i < items.length) {
    const item = items[i++];
    const p = enqueue(item);
    executing.push(p.then(() => {
      executing.splice(executing.indexOf(p), 1);
    }));
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
}

async function iterateAndDelete(event: H3Event, signal: AbortSignal, opts: R2ListOptions, remove: boolean) {
  const binding = useBinding(event);
  let truncated = true;
  let cursor: string | undefined = opts.cursor;
  let processed = 0;
  const removedItems: Array<{ key: string; uploaded: Date; downloadedAt?: Date }> = [];
  const downloadedAtBucket = useDownloadedAtBucket(event);
  const today = Date.parse(new Date().toString());
  const CONCURRENCY = 5;

  while (truncated && !signal.aborted) {
    if (removedItems.length >= 100 || processed >= 10000) {
      break;
    }
    const next = await binding.list({
      ...opts,
      cursor,
    });
    processed += next.objects.length;

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
      }
    });

    truncated = next.truncated;
    if (next.truncated) {
      cursor = next.cursor;
    }
  }
  return {
    cursor,
    truncated,
    removedItems,
  };
}


