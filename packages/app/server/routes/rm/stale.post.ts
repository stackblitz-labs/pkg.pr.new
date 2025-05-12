import type { H3Event } from "h3";

export default eventHandler(async (event) => {
  setResponseHeader(event, "Transfer-Encoding", "chunked");
  setResponseHeader(event, "Cache-Control", "no-cache");
  setResponseHeader(event, "Content-Type", "text/plain");

  const rmStaleKeyHeader = getHeader(event, "sb-rm-stale-key");
  const signal = toWebRequest(event).signal;
  // const { rmStaleKey } = useRuntimeConfig(event);
  // if (rmStaleKeyHeader !== rmStaleKey) {
  //   throw createError({
  //     status: 403,
  //   });
  // }
  const { readable, writable } = new TransformStream()

  event.waitUntil(
    (async () => {
      // const writer = writable.getWriter()
      // console.log('here')
      // await writer.ready
      // await writer.write(new TextEncoder().encode("start\n"))
      // writer.releaseLock()

      await iterateAndDelete(event, writable, signal, {
        prefix: usePackagesBucket.base,
        limit: 100,
      })
      await iterateAndDelete(event, writable, signal, {
        prefix: useTemplatesBucket.base,
        limit: 100,
      })
      await writable.close()
    })()
  )

  return readable
});

async function iterateAndDelete(event: H3Event, writable: WritableStream, signal: AbortSignal, opts: R2ListOptions) {
  const writer = writable.getWriter()
  await writer.ready
  const binding = useBinding(event);

  let truncated = true;
  let cursor: string | undefined;

  const downloadedAtBucket = useDownloadedAtBucket(event);
  const today = Date.parse(new Date().toString());

  while (truncated && !signal.aborted) {
    // TODO: Avoid using context.cloudflare and migrate to unstorage, but it does not have truncated for now
    const next = await binding.list({
      ...opts,
      cursor,
    });
    for (const object of next.objects) {
      if (signal.aborted) {
        break;
      }
      const uploaded = Date.parse(object.uploaded.toString());
      // remove the object anyway if it's 6 months old already
      // Use calendar-accurate 6 months check
      const uploadedDate = new Date(uploaded);
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      if (uploadedDate <= sixMonthsAgo) {
        await writer.write(new TextEncoder().encode(JSON.stringify({
          key: object.key,
          uploaded: new Date(object.uploaded),
          downloadedAt: new Date((await downloadedAtBucket.getItem(object.key))!),
        }) + "\n"))
        // event.context.cloudflare.context.waitUntil(binding.delete(object.key));
        // event.context.cloudflare.context.waitUntil(
        //   downloadedAtBucket.removeItem(object.key),
        // );
      }
      const downloadedAt = (await downloadedAtBucket.getItem(object.key))!;
      // if it has not been downloaded in the last month and it's at least 1 month old
      // Calendar-accurate 1 month checks
      const downloadedAtDate = new Date(downloadedAt);
      const oneMonthAgo = new Date(today);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const uploadedDate2 = new Date(uploaded); // uploaded already parsed above
      if (
        downloadedAtDate <= oneMonthAgo &&
        uploadedDate2 <= oneMonthAgo
      ) {
        await writer.write(new TextEncoder().encode(JSON.stringify({
          key: object.key,
          uploaded: new Date(object.uploaded),
          downloadedAt: new Date(downloadedAt),
        }) + "\n"))
        // event.context.cloudflare.context.waitUntil(binding.delete(object.key));
        // event.context.cloudflare.context.waitUntil(
        //   downloadedAtBucket.removeItem(object.key),
        // );
      }
    }

    truncated = next.truncated;
    if (next.truncated) {
      cursor = next.cursor;
    }
  }
  writer.releaseLock()
}
