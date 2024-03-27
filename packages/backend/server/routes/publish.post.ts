import { objectHash, sha256 } from "ohash";
import { generateCommitPublishMessage } from "../utils/markdown";

export default eventHandler(async (event) => {
  const contentLength = Number(getHeader(event, "content-length"));
  // 5mb limits for now
  if (contentLength > 1024 * 1024 * 5) {
    // Payload too large
    return new Response("Max size limit is 5mb", { status: 413 });
  }
  const {
    "sb-package-name": packageName,
    "sb-commit-timestamp": commitTimestampStr,
    "sb-key": key
  } = getHeaders(event);
  if (!key || !packageName || !commitTimestampStr) {
    throw createError({
      statusCode: 400,
      message: "sb-package-name, sb-commit-timestamp, sb-key headers are required"
    })
  }

  const workflowsBucket = useWorkflowsBucket(event);
  const packagesBucket = usePackagesBucket(event);
  const cursorBucket = useCursorBucket(event);
  if (!(await workflowsBucket.hasItem(key))) {
    console.log('key', key)
    throw createError({
      statusCode: 401,
      message: "Try publishing from a github workflow or install Stackblitz CR Github app on this repo"
    })
  }

  const binary = await readRawBody(event, false);
  
  if (!packageName || !commitTimestampStr) {
    throw createError({
      statusCode: 400,
      message: "sb-key header is missing"
    })
    
  }
  const commitTimestamp = Number(commitTimestampStr);

  const workflowData = (await workflowsBucket.getItem(key))!;
  const { sha, ...hashPrefixMetadata } = workflowData;
  const metadataHash = sha256(objectHash(hashPrefixMetadata));
  const packageKey = `${metadataHash}:${sha}:${packageName}`;

  const currentCursor = await cursorBucket.getItem(metadataHash);

  await packagesBucket.setItemRaw(packageKey, binary);
  if (!currentCursor || currentCursor.timestamp < commitTimestamp) {
    await cursorBucket.setItem(metadataHash, {
      sha,
      timestamp: commitTimestamp,
    });
  }

  await workflowsBucket.removeItem(key);

  const app = useOctokitApp(event);
  const origin = getRequestURL(event).origin;

  // await app.octokit.request("POST /repos/{owner}/{repo}/check-runs", {
  //   name: "Stackblitz CR (Publish)",
  //   owner: workflowData.orgOrAuthor,
  //   repo: workflowData.repo,
  //   head_sha: sha,
  //   output: {
  //     title: "Stackblitz CR",
  //     summary: "Published successfully.",
  //     text: generateCommitPublishMessage(origin, packageName, workflowData),
  //   },
  //   conclusion: "success",
  // });

  return { ok: true };
});
