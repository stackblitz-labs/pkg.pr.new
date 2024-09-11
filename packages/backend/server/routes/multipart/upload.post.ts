import type { R2UploadedPart } from "@cloudflare/workers-types";

export default eventHandler(async (event) => {
  const {
    "key": key,
    "id": id,

    "part-number": partNumberHeader,

    "uploaded-parts": uploadedPartsHeader
  } = getHeaders(event);

  const partNumber = Number(partNumberHeader)
  const binding =
    event.context.cloudflare.env.ENV === "production"
      ? event.context.cloudflare.env.PROD_CR_BUCKET
      : event.context.cloudflare.env.CR_BUCKET;

  const upload = binding.resumeMultipartUpload(key!, id!)
  if (uploadedPartsHeader) {
    const uploadedParts: R2UploadedPart[] = JSON.parse(uploadedPartsHeader!)

    const object = await upload.complete(uploadedParts)
    return {
      ok: true,
      key: object.key
    }
  } else {
    const buffer = (await readRawBody(event, false))!
    const part = await upload.uploadPart(partNumber, buffer)

    return {
      ok: true,
      part
    }
  }
})

