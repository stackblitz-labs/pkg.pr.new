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
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'sb-rm-stale-key': staleKey,
        },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        console.error(`[${bucket}] Batch ${batch} - Failed to parse response:`, text);
        process.exit(1);
      }
      if (!res.ok) {
        console.error(`[${bucket}] Batch ${batch} - Request failed:`, json);
        process.exit(1);
      }
      console.log(`[${bucket}] Batch ${batch} - Removed items:`, json.result.removedItems.length);
      if (json.result.removedItems.length > 0) {
        for (const item of json.result.removedItems) {
          console.log(`  -`, item);
        }
      }
      cursor = json.result.cursor;
      truncated = json.result.truncated;
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
  for (const bucket of ['packages', 'templates']) {
    console.log(`Processing bucket: ${bucket}`);
    await processBucket(bucket);
  }
})();
