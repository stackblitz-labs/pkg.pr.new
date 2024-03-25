import { objectHash, sha256 } from "ohash";
import { WorkflowData } from "../../../../types";

type Params = Omit<WorkflowData, "sha"> & {
  package: string;
};

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const packagesBucket = usePackagesBucket();

  const { package: packageName, ...hashPrefixMetadata } = params;
  const metadataHash = sha256(objectHash(hashPrefixMetadata));
  const keys = await packagesBucket.getKeys(metadataHash)
  console.log(keys)
  // const packageKey = `${metadataHash}:${sha}:${packageName.split('.tgz')[0]}`;
  // if (!(await packagesBucket.hasItem(packageKey))) {
  //   throw createError({
  //     status: 404,
  //   });
  // }
  // const buffer = await packagesBucket.getItemRaw<ArrayBuffer>(packageKey);

  // setResponseHeader(event, "content-type", "application/tar+gzip");
  // // add caching
  // return new Response(buffer);
});
