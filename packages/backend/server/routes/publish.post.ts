import { objectHash, sha256 } from "ohash";

export default eventHandler(async (event) => {
  const contentLength = Number(getHeader(event, "content-length"));
  // 5mb limits for now
  if (contentLength > 1024 * 1024 * 5) {
    // Payload too large
    return new Response("Max size limit is 5mb", { status: 413 });
  }
  const key = getRequestHeader(event, "sb-key");
  const workflowsBucket = useWorkflowsBucket();
  const packagesBucket = usePackagesBucket();

  if (!(await workflowsBucket.hasItem(key))) {
    return new Response("", { status: 401 });
  }

  const binary = await readRawBody(event, false);
  const {
    "sb-package-name": packageName,
    "sb-package-version": _,
  } = getHeaders(event);

  const workflowData = await workflowsBucket.getItem(key);
  const { sha, ...hashPrefixMetadata } = workflowData;
  const metadataHash = sha256(objectHash(hashPrefixMetadata));
  const packageKey = `${metadataHash}:${sha}:${packageName}`;
  console.log(hashPrefixMetadata)
  console.log('publish packageKey', packageKey)

  await packagesBucket.setItemRaw(packageKey, binary);

  await workflowsBucket.removeItem(key);

  return { ok: true };
});
