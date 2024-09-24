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
  
  if (!(await workflowsBucket.hasItem(key))) {
    throw createError({
      statusCode: 401,
      message:
        "Try doing multipart uploads from a github workflow! Also make sure you install https://github.com/apps/pkg-pr-new Github app on the repo",
    });
  }
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
  const base = `${workflowData.owner}:${workflowData.repo}:${abbreviatedSha}`
  const packageKey = `${base}:${packageName}`;

  const upload = await binding.createMultipartUpload(packageKey);

  return {
    packageKey,
    ok: true,
    key: upload.key,
    id: upload.uploadId,
  };
});
