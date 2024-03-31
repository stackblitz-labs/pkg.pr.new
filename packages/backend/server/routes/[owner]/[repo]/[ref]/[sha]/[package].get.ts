import { objectHash, sha256 } from "ohash";
import { WorkflowData } from "../../../../../types";
import { useDownloadedAtBucket } from "../../../../../utils/bucket";

type Params = WorkflowData & {
  package: string;
};

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const packagesBucket = usePackagesBucket(event);
  const downloadedAtBucket = useDownloadedAtBucket(event)

  const { sha, package: packageName, ...hashPrefixMetadata } = params;
  const metadataHash = sha256(objectHash(hashPrefixMetadata));
  const packageKey = `${metadataHash}:${sha}:${packageName.split('.tgz')[0]}`;
  if (!(await packagesBucket.hasItem(packageKey))) {
    throw createError({
      status: 404,
    });
  }
  
  const buffer = await packagesBucket.getItemRaw<ArrayBuffer>(packageKey);
  const obj = (await packagesBucket.getMeta(packageKey)) as unknown as R2Object
  // TODO: less writes
  await downloadedAtBucket.setItem(obj.key, Date.parse(new Date().toString()))

  setResponseHeader(event, "content-type", "application/tar+gzip");
  // add caching
  return new Response(buffer);
});
