const endpoint = process.env.STALE_ENDPOINT;
const staleKey = process.env.STALE_KEY;
const remove = process.env.STALE_REMOVE === 'true';

if (!endpoint || !staleKey) {
  console.error('STALE_ENDPOINT and STALE_KEY environment variables are required.');
  process.exit(1);
}

async function processBucket(bucket) {
  let cursor = null;
  let batch = 0;
  let truncated = true;
  while (truncated) {
    const body = {
      bucket,
      cursor,
      remove,
    };
    try {
      console.log(`[${bucket}] Batch ${batch} - Fetching...`);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'sb-rm-stale-key': staleKey,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.error(`[${bucket}] Batch ${batch} - Request failed:`, json);
        process.exit(1);
      }

      const json = await res.json();

      console.log(`[${bucket}] Batch ${batch} - Removed items:`, json.result.removedItems.length);
      if (json.result.removedItems.length > 0) {
        for (const item of json.result.removedItems) {
          console.log(`  -`, item);
        }
      }
      console.log('just fetched', json.result.removedItems.length)
      cursor = json.result.cursor;
      truncated = json.result.truncated;
      console.log('cursor', cursor)
      console.log('truncated', truncated)
      batch++;
      if (!truncated) {
        console.log(`[${bucket}] Completed. Total batches: ${batch}`);
      }
    } catch (e) {
      console.error(`[${bucket}] Batch ${batch} - Request failed:`, e);
      process.exit(1);
    }
  }
}

(async () => {
  // for (const bucket of ['packages', 'templates']) {
  for (const bucket of ['packages']) {
    console.log(`Processing bucket: ${bucket}`);
    await processBucket(bucket);
  }
  process.exit(0);
})();
