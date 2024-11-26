import { sha256 } from "ohash";

export default eventHandler(async (event) => {
  try {
    const binding = useBinding(event);

    const query = getQuery(event);
    let cursor = query.cursor || undefined;

    const limit = 100;
    let currentCount = 0;
    let objectCount = 0;
    let started = false;

    const encoder = new TextEncoder();

    const packagesPrefix = `${usePackagesBucket.base}:`;
    const cursorsPrefix = `${useCursorsBucket.base}:`;

    const stream = new ReadableStream({
      async pull(controller) {
        if (started && !cursor) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                summary: {
                  ok: true,
                  objects: objectCount,
                  nextCursor: null,
                },
              }) + "\n"
            )
          );
          controller.close();
          return;
        }

        started = true;

        try {
          const response = await binding.list({ cursor });
          let responseCount = 0;

          for (const { key } of response.objects) {
            if (currentCount >= limit) {
              cursor = response.cursor;
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({
                    nextCursor: cursor,
                  }) + "\n"
                )
              );
              return;
            }

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
              const ref = trimmedKey.split(":")[2];

              result = {
                type: "cursor",
                org: sha256(trimmedKey.split(":")[0]),
                repo: sha256(trimmedKey.split(":")[1]),
                ref: sha256(ref),
              };
            }

            if (result) {
              controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
              objectCount++;
              currentCount++;
              responseCount++;
            }
          }

          if (response.truncated && responseCount === response.objects.length) {
            cursor = response.cursor;
          } else {
            cursor = null;
          }

          if (!cursor) {
            controller.enqueue(
              encoder.encode(
                JSON.stringify({
                  summary: {
                    ok: true,
                    objects: objectCount,
                    nextCursor: null,
                  },
                }) + "\n"
              )
            );
            controller.close();
          }
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return sendStream(event, stream);
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
