import { sha256 } from "ohash";

export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);
    const query = getQuery(event);

    let cursor = (query.cursor as string) || undefined;
    let objectCount = 0;

    const packagesPrefix = `${usePackagesBucket.base}:`;
    const cursorsPrefix = `${useCursorsBucket.base}:`;
    const templatesPrefix = `${useTemplatesBucket.base}:`;

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
          org: sha256(org),
          repo: sha256(repo),
          commit: sha256(commit),
          packageName: sha256(packageName),
        };
      } else if (key.startsWith(cursorsPrefix)) {
        const trimmedKey = key.slice(cursorsPrefix.length);
        const parts = trimmedKey.split(":");
        const ref = parts.slice(2).join(":");

        result = {
          type: "cursor",
          org: sha256(parts[0]),
          repo: sha256(parts[1]),
          ref: sha256(ref),
        };
      } else if (key.startsWith(templatesPrefix)) {
        const trimmedKey = key.slice(templatesPrefix.length);
        const template = trimmedKey;

        result = {
          type: "template",
          template: sha256(template),
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
