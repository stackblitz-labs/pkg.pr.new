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
  const allRemovedItems = [];
  while (truncated && allRemovedItems.length < 10000) {
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
        console.error(`[${bucket}] Batch ${batch} - Request failed:`, await res.text());
        process.exit(1);
      }

      const json = await res.json();
      const toAdd = json.removedItems.slice(0, 10000 - allRemovedItems.length);
      allRemovedItems.push(...toAdd);

      console.log(`[${bucket}] Batch ${batch} - Removed items:`, json.removedItems.length);
      cursor = json.cursor;
      truncated = json.truncated;
      batch++;
      if (!truncated || allRemovedItems.length >= 10000) {
        console.log(`[${bucket}] Completed. Total batches: ${batch}`);
      }
    } catch (e) {
      console.error(`[${bucket}] Batch ${batch} - Request failed:`, e);
      process.exit(1);
    }
  }

  // Verification logic for first 10,000 removed items
  const now = Date.now();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  let passCount = 0;
  let failCount = 0;
  const failedItems = [];

  for (let i = 0; i < allRemovedItems.length; i++) {
    const item = allRemovedItems[i];
    const uploadedDate = new Date(item.uploaded);
    if (uploadedDate <= sixMonthsAgo) {
      passCount++;
      continue;
    }
    if (item.downloadedAt) {
      const downloadedAtDate = new Date(item.downloadedAt);
      if (downloadedAtDate <= oneMonthAgo && uploadedDate <= oneMonthAgo) {
        passCount++;
        continue;
      }
    }
    failCount++;
    failedItems.push(item);
  }

  console.log(`Verification complete for first 10,000 removed items.`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  if (failCount > 0) {
    console.log(`First 5 failed items:`, failedItems.slice(0, 5));
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
