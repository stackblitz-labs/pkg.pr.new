export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);

    let cursor: string | undefined;
    let totalObjects = 0;
    const orgs = new Set<string>();
    const repos = new Set<string>();
    const commits = new Set<string>();
    const packages = new Set<string>();

    const prefix = `${usePackagesBucket.base}:`;

    do {
      const result = await binding.list({ prefix, cursor });
      const keys = result.objects.map((obj) => obj.key);

      totalObjects += keys.length;

      for (const key of keys) {
        const trimmedKey = key.slice(prefix.length);
        const parts = trimmedKey.split(":");
        const [org, repo, commit, packageName] = parts;

        if (org && repo && commit && packageName) {
          orgs.add(org);
          repos.add(repo);
          commits.add(commit);
          packages.add(packageName);
        }
      }

      cursor = result.truncated ? result.cursor : undefined;
    } while (cursor);

    return {
      ok: true,
      totalObjects,
      totalOrgs: orgs.size,
      totalRepos: repos.size,
      totalCommits: commits.size,
      totalPackages: packages.size,
    };
  } catch (error) {
    throw createError({
      statusCode: 500
    });
  }
});
