export default eventHandler(async (event) => {
  const {
    key,
    id,
    'part-number': partNumberHeader,
  } = getHeaders(event)

  const partNumber = Number(partNumberHeader)
  const binding = useBinding(event)

  const upload = binding.resumeMultipartUpload(key!, id!)
  const buffer = (await readRawBody(event, false))!
  const part = await upload.uploadPart(partNumber, buffer)

  return {
    ok: true,
    part,
  }
})
