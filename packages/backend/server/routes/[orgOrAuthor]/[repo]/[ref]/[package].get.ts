import { objectHash, sha256 } from "ohash";
import { WorkflowData } from "../../../../types";

type Params = Omit<WorkflowData, "sha"> & {
  package: string;
};

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;

  const { package: packageName, ...hashPrefixMetadata } = params;
  const metadataHash = sha256(objectHash(hashPrefixMetadata));

  const cursorBucket = useCursorBucket(event);
  if (!(await cursorBucket.hasItem(metadataHash))) {
    throw createError({
      status: 404,
    });
  }
  const currentCursor = (await cursorBucket.getItem(metadataHash))!;

  sendRedirect(
    event,
    `/${params.orgOrAuthor}/${params.repo}/${params.ref}/${currentCursor.sha}/${params.package}`
  );
});
