import { z } from 'zod'

const paramsSchema = z.object({
  uuid: z.string(),
})

export default eventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, paramsSchema.parse)
  const templatesBucket = useTemplatesBucket(event)
  const downloadedAtBucket = useDownloadedAtBucket(event)
  const stream = await getItemStream(
    event,
    useTemplatesBucket.base,
    params.uuid,
  )
  const obj = (await templatesBucket.getMeta(
    params.uuid,
  )) as unknown as R2Object

  await downloadedAtBucket.setItem(obj.key, Date.parse(new Date().toString()))

  return stream
})
