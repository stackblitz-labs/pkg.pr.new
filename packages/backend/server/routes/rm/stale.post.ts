import type { H3EventContext } from "h3";
import { useDownloadedAtBucket } from "../../utils/bucket";

declare module "nitropack/dist/runtime/task" {
  interface TaskContext {
    cloudflare: H3EventContext["cloudflare"];
  }
}

const options: R2ListOptions = {
  prefix: usePackagesBucket.base,
  limit: 500,
};

export default eventHandler(async (event) => {
  const rmStaleKeyHeader = getHeader(event, "sb-rm-stale-key");
  const { rmStaleKey } = useRuntimeConfig(event);
  if (rmStaleKeyHeader !== rmStaleKey) {
    throw createError({
      status: 403,
    });
  }
  const binding =
    event.context.cloudflare.env.ENV === "production"
      ? event.context.cloudflare.env.PROD_CR_BUCKET
      : event.context.cloudflare.env.CR_BUCKET;

  const downloadedAtBucket = useDownloadedAtBucket(event);
  const today = Date.parse(new Date().toString());
  let truncated = true;
  let cursor: string | undefined;

  while (truncated) {
    // TODO: Avoid using context.cloudflare and migrate to unstorage, but it does not have truncated for now
    const next = await binding.list({
      ...options,
      cursor: cursor,
    });
    for (const object of next.objects) {
      const uploaded = Date.parse(object.uploaded.toString());
      // remove the object anyway if it's 6 months old already
      if ((today - uploaded) / (1000 * 3600 * 24 * 30 * 6) >= 1) {
        event.context.cloudflare.context.waitUntil(binding.delete(object.key));
        event.context.cloudflare.context.waitUntil(
          downloadedAtBucket.removeItem(object.key),
        );
      }
      const downloadedAt = (await downloadedAtBucket.getItem(object.key))!;
      // if it has not been downloaded in the last month and it's at least 1 month old
      if (
        !((today - downloadedAt) / (1000 * 3600 * 24 * 30) < 1) &&
        (today - uploaded) / (1000 * 3600 * 24 * 30) >= 1
      ) {
        event.context.cloudflare.context.waitUntil(binding.delete(object.key));
        event.context.cloudflare.context.waitUntil(
          downloadedAtBucket.removeItem(object.key),
        );
      }
    }

    truncated = next.truncated;
    if (next.truncated) {
      cursor = next.cursor;
    }
  }
  return { ok: true };
});
