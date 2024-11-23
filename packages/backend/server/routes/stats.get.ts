export default eventHandler(async (event) => {
  try {
    const packagesBucket = usePackagesBucket(event);

    const keys = await packagesBucket.getKeys();

    const orgs = new Set<string>();
    const packages = new Set<string>();

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

    return {
      ok: true,
      totalKeys: keys.length,
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
