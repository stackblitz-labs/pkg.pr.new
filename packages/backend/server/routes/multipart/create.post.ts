import { joinKeys } from "unstorage";
import { isWhitelisted } from "@pkg-pr-new/utils";

export default eventHandler(async (event) => {
  const { "sb-key": workflowKey, "sb-name": packageName } = getHeaders(event);

  if (!workflowKey) {
    throw createError({
      statusCode: 400,
      message: "sb-key is required",
    });
  }
  const workflowsBucket = useWorkflowsBucket(event);

  if (!(await workflowsBucket.hasItem(workflowKey))) {
    throw createError({
      statusCode: 401,
      message:
        "Try doing multipart uploads from a github workflow! Also make sure you install https://github.com/apps/pkg-pr-new GitHub app on the repo",
    });
  }
  const workflowData = (await workflowsBucket.getItem(workflowKey))!;

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

  const base = `${workflowData.owner}:${workflowData.repo}:${workflowData.sha}`;
  const packageKey = `${base}:${packageName}`;

  const key = joinKeys(usePackagesBucket.base, packageKey);
  const upload = await binding.createMultipartUpload(key);

  return {
    ok: true,
    key: upload.key,
    id: upload.uploadId,
  };
});
