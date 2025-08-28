export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);

    // List contents of the downloaded-at bucket (where PR bucket is accidentally reading from)
    const downloadedAtResult = await binding.list({
      prefix: useDownloadedAtBucket.key, // "downloaded-at"
      limit: 50,
    });

    // Also list contents of the correct pr-number bucket
    const prNumberResult = await binding.list({
      prefix: usePullRequestNumbersBucket.key, // "pr-number"
      limit: 50,
    });

    // Get some sample values
    const downloadedAtSamples = [];
    for (const obj of downloadedAtResult.objects.slice(0, 10)) {
      try {
        const value = await binding.get(obj.key);
        const body = await value?.text();
        downloadedAtSamples.push({
          key: obj.key,
          value: body,
          size: obj.size,
          uploaded: obj.uploaded,
        });
      } catch (e) {
        downloadedAtSamples.push({
          key: obj.key,
          value: `Error: ${e.message}`,
          size: obj.size,
          uploaded: obj.uploaded,
        });
      }
    }

    return {
      bucketPrefixBug:
        "usePullRequestNumbersBucket uses 'downloaded-at' prefix instead of 'pr-number'",
      downloadedAtBucket: {
        prefix: useDownloadedAtBucket.key,
        totalKeys: downloadedAtResult.objects.length,
        keys: downloadedAtResult.objects.map((obj) => obj.key),
        samples: downloadedAtSamples,
      },
      prNumberBucket: {
        prefix: usePullRequestNumbersBucket.key,
        totalKeys: prNumberResult.objects.length,
        keys: prNumberResult.objects.map((obj) => obj.key),
      },
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
