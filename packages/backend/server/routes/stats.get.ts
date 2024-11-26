// import { sha256 } from "ohash";

export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);
    const query = getQuery(event);

    let cursor = query.cursor || undefined;
    let objectCount = 0;

    const packagesPrefix = `${usePackagesBucket.base}:`;
    const cursorsPrefix = `${useCursorsBucket.base}:`;

    const results = [];

    const response = await binding.list({ cursor, limit: 500 });
    objectCount += response.objects.length;

    for (const { key } of response.objects) {
      let result = null;

      if (key.startsWith(packagesPrefix)) {
        const trimmedKey = key.slice(packagesPrefix.length);
        const [org, repo, commit, ...packageNameParts] = trimmedKey.split(":");
        const packageName = packageNameParts.join(":");

        result = {
          type: "package",
          org: org,
          repo: repo,
          commit: commit,
          packageName: packageName,
        };
      } else if (key.startsWith(cursorsPrefix)) {
        const trimmedKey = key.slice(cursorsPrefix.length);
        const parts = trimmedKey.split(":");
        const ref = parts[2];

        result = {
          type: "cursor",
          org: parts[0],
          repo: parts[1],
          ref: ref,
        };
      }

      if (result) {
        results.push(result);
      }
    }

    const nextCursor = response.truncated ? response.cursor : null;

    return {
      data: results,
      nextCursor: nextCursor,
    };
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
