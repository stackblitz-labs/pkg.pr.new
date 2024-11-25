export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);

    let cursor: string | undefined;
    let objectCount = 0;
    let branches = 0
    let prs = 0
    const orgs = new Set<string>();
    const repos = new Set<string>();
    const commits = new Set<string>();
    const packages = new Set<string>();

    const packagesPrefix = `${usePackagesBucket.base}:`;
    const cursorsPrefix = `${useCursorsBucket.base}:`;

    do {
      const { objects, truncated, cursor: nextCursor } = await binding.list({ cursor });
      objectCount += objects.length;

      for (const { key } of objects) {
        if (key.startsWith(packagesPrefix)) {
          const trimmedKey = key.slice(packagesPrefix.length);
          const [org, repo, commit, packageName] = trimmedKey.split(":");
  
          orgs.add(org);
          repos.add(repo);
          commits.add(commit);
          packages.add(packageName);
        } else if (key.startsWith(cursorsPrefix)) {
          const trimmedKey = key.slice(cursorsPrefix.length);
          const ref = trimmedKey.split(":")[2];
          const prNumber = Number(ref)
          if (!isNaN(prNumber)) {
            prs++
          } else {
            branches++
          }
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
      branches: branches,
      prs: prs,
      packages: packages.size,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error?.message 
    });
  }
});
