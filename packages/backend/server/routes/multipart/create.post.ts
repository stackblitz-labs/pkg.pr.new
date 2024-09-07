import { isWhitelisted } from "@pkg-pr-new/utils";
import { init } from "@paralleldrive/cuid2";

const createId = init({ length: 32 });

export default eventHandler(async (event) => {
  const { "sb-key": key } = getHeaders(event);

  if (!key) {
    throw createError({
      statusCode: 400,
      message: "sb-key is required",
    });
  }
  const workflowsBucket = useWorkflowsBucket(event);
  const workflowData = (await workflowsBucket.getItem(key))!;

  const whitelisted = await isWhitelisted(
    workflowData.owner,
    workflowData.repo,
  );

  if (!whitelisted) {
    // Payload too large
    throw createError({
      statusCode: 413,
      message:
        "Multipart uploads are only accessible to those who are in the whitelist! Feel free to apply for the whitelist: https://github.com/stackblitz-labs/pkg.pr.new/blob/main/.whitelist",
    });
  }

  const binding = useBinding(event);

  const upload = await binding.createMultipartUpload(`${key}:${createId()}`);

  return {
    ok: true,
    key: upload.key,
    id: upload.uploadId,
  };
});
