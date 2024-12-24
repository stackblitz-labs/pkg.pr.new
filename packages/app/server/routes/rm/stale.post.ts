import type { H3Event } from 'h3'

export default eventHandler(async (event) => {
  const rmStaleKeyHeader = getHeader(event, 'sb-rm-stale-key')
  const { rmStaleKey } = useRuntimeConfig(event)
  if (rmStaleKeyHeader !== rmStaleKey) {
    throw createError({
      status: 403,
    })
  }
  return {
    ok: true,
    removed: [
      ...(await Promise.all([
        iterateAndDelete(event, {
          prefix: usePackagesBucket.base,
          limit: 100,
        }),
        iterateAndDelete(event, {
          prefix: useTemplatesBucket.base,
          limit: 100,
        }),
      ]).then(results => results.flat())),
    ],
  }
})

async function iterateAndDelete(event: H3Event, opts: R2ListOptions) {
  const binding
    = event.context.cloudflare.env.ENV === 'production'
      ? event.context.cloudflare.env.PROD_CR_BUCKET
      : event.context.cloudflare.env.CR_BUCKET

  let truncated = true
  let cursor: string | undefined

  const downloadedAtBucket = useDownloadedAtBucket(event)
  const today = Date.parse(new Date().toString())

  const removed: string[] = []
  while (truncated) {
    // TODO: Avoid using context.cloudflare and migrate to unstorage, but it does not have truncated for now
    const next = await binding.list({
      ...opts,
      cursor,
    })
    for (const object of next.objects) {
      const uploaded = Date.parse(object.uploaded.toString())
      // remove the object anyway if it's 6 months old already
      if ((today - uploaded) / (1000 * 3600 * 24 * 30 * 6) >= 1) {
        removed.push(object.key)
        event.context.cloudflare.context.waitUntil(binding.delete(object.key))
        event.context.cloudflare.context.waitUntil(
          downloadedAtBucket.removeItem(object.key),
        )
      }
      const downloadedAt = (await downloadedAtBucket.getItem(object.key))!
      // if it has not been downloaded in the last month and it's at least 1 month old
      if (
        !((today - downloadedAt) / (1000 * 3600 * 24 * 30) < 1)
        && (today - uploaded) / (1000 * 3600 * 24 * 30) >= 1
      ) {
        removed.push(object.key)
        event.context.cloudflare.context.waitUntil(binding.delete(object.key))
        event.context.cloudflare.context.waitUntil(
          downloadedAtBucket.removeItem(object.key),
        )
      }
    }

    truncated = next.truncated
    if (next.truncated) {
      cursor = next.cursor
    }
  }
  return removed
}
