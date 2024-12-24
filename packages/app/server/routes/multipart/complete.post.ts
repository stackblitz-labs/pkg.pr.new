import type { R2UploadedPart } from '@cloudflare/workers-types'

export default eventHandler(async (event) => {
  const {
    key,
    id,
    'uploaded-parts': uploadedPartsHeader,
  } = getHeaders(event)

  const binding = useBinding(event)

  const upload = binding.resumeMultipartUpload(key!, id!)
  const uploadedParts: R2UploadedPart[] = JSON.parse(uploadedPartsHeader!)

  const object = await upload.complete(uploadedParts)

  return {
    ok: true,
    key: object.key,
  }
})
