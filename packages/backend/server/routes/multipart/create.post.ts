import { abbreviateCommitHash, isWhitelisted } from "@pkg-pr-new/utils";

export default eventHandler(async (event) => {
  const { "sb-key": key, "sb-name": packageName } = getHeaders(event);

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

  const abbreviatedSha = abbreviateCommitHash(workflowData.sha);
  const baseKey = `${workflowData.owner}:${workflowData.repo}`;
  const packageKey = `${baseKey}:${abbreviatedSha}:${packageName}`;

  const upload = await binding.createMultipartUpload(packageKey);

  return {
    ok: true,
    key: upload.key,
    id: upload.uploadId,
  };
});
