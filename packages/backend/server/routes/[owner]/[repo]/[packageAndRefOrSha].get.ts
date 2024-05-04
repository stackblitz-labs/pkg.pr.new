import { WorkflowData } from "../../../types";

type Params = Omit<WorkflowData, "sha" | "isPullRequest" | "ref"> & {
  packageAndRefOrSha: string;
};

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const [packageName, refOrSha] = params.packageAndRefOrSha.split("@");
  const packageKey = `${params.owner}:${params.repo}:${refOrSha}:${packageName.split(".tgz")[0]}`;
  const cursorKey = `${params.owner}:${params.repo}:${refOrSha}`;

  const packagesBucket = usePackagesBucket(event);
  const downloadedAtBucket = useDownloadedAtBucket(event);
  const cursorBucket = useCursorsBucket(event);

  if (await packagesBucket.hasItem(packageKey)) {
    const buffer = await packagesBucket.getItemRaw<ArrayBuffer>(packageKey);
    const obj = (await packagesBucket.getMeta(
      packageKey,
    )) as unknown as R2Object;
    // TODO: less writes
    await downloadedAtBucket.setItem(
      obj.key,
      Date.parse(new Date().toString()),
    );

    setResponseHeader(event, "content-type", "application/tar+gzip");
    // add caching
    return new Response(buffer);
  } else if (await cursorBucket.hasItem(cursorKey)) {
    const currentCursor = (await cursorBucket.getItem(cursorKey))!;

    sendRedirect(
      event,
      `/${params.owner}/${params.repo}/${packageName}@${currentCursor.sha}`,
    );
    return;
  }

  throw createError({
    status: 404,
  });
});
