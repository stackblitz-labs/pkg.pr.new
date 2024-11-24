export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);

    let cursor: string | undefined;
    let objectCount = 0;
    const orgs = new Set<string>();
    const repos = new Set<string>();
    const commits = new Set<string>();
    const packages = new Set<string>();

    const prefix = `${usePackagesBucket.base}:`;

    do {
      const { objects, truncated, cursor: nextCursor } = await binding.list({ prefix, cursor });
      objectCount += objects.length;

      for (const { key } of objects) {
        const trimmedKey = key.slice(prefix.length);
        const parts = trimmedKey.split(":");

        if (parts[0] && parts[1] && parts[2] && parts[3]) {
          orgs.add(parts[0]);
          repos.add(parts[1]);
          commits.add(parts[2]);
          packages.add(parts[3]);
        }
      }

      cursor = truncated ? nextCursor : undefined;
    } while (cursor);

    return {
      ok: true,
      objects: objectCount,
      orgs: orgs.size,
      repos: repos.size,
      commits: commits.size,
      packages: packages.size,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error?.message 
    });
  }
});
