export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);

    let cursor: string | undefined = undefined;
    let totalObjects = 0;
    let totalSize = 0; 
    const orgs = new Set<string>();
    const packages = new Set<string>();
    const commits = new Set<string>(); 

    const prefix = `${usePackagesBucket.base}:`;

    do {
      const result = await binding.list({ prefix, cursor });

      const keys = result.objects.map((obj) => obj.key);
      totalObjects += keys.length;

      for (const obj of result.objects) {
        const key = obj.key;
        const size = obj.size || 0;
        totalSize += size;

        if (!key.startsWith(prefix)) {
          continue;
        }

        const trimmedKey = key.slice(prefix.length);

        const parts = trimmedKey.split(":");

        if (parts.length >= 3) {
          const org = parts[0];
          const pkg = parts[1];
          const commit = parts[2];
          orgs.add(org);
          packages.add(pkg);
          commits.add(commit);
        }
      }

      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);

    return {
      ok: true,
      totalObjects,
      totalSize,
      formattedTotalSize: formatBytes(totalSize),
      totalOrgs: orgs.size,
      totalPackages: packages.size,
      totalCommits: commits.size,
    };
  } catch (error) {
    console.error("Failed to fetch package stats.", {
      message: error.message,
      stack: error.stack,
    });
    throw createError({
      statusCode: 500,
      message: `Failed to fetch package stats: ${error.message || "Unknown error"}`,
    });
  }
});

function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
