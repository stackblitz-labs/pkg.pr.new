export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);

    let cursor: string | undefined = undefined;
    let totalObjects = 0;
    const orgs = new Set<string>();
    const packages = new Set<string>();

    do {
      const result = await binding.list({ cursor });
      const keys = result.objects.map((obj) => obj.key);

      totalObjects += keys.length;

      for (const key of keys) {
        const parts = key.split(":");

        if (parts.length >= 2) {
          const org = parts[0];
          const pkg = parts[1];
          orgs.add(org);
          packages.add(pkg);
        } else {
          console.warn(`Key does not conform to expected structure: ${key}`);
        }
      }

      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);

    return {
      ok: true,
      totalObjects,
      totalOrgs: orgs.size,
      totalPackages: packages.size,
    };
  } catch (error) {
    console.error("Failed to fetch package stats", error);
    throw createError({
      statusCode: 500,
      message: `Failed to fetch package stats: ${error.message || "Unknown error"}`,
    });
  }
});
