import { WorkflowData } from "../../../types";

type Params = Omit<WorkflowData, "sha" | "ref"> & {
  packageAndRefOrSha: string;
};

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const [encodedPackageName, refOrSha] = params.packageAndRefOrSha.split("@");
  const packageName = decodeURIComponent(encodedPackageName)

  const packageKey = `${params.owner}:${params.repo}:${refOrSha}:${packageName.split(".tgz")[0]}`;
  const cursorKey = `${params.owner}:${params.repo}:${refOrSha}`;

  const packagesBucket = usePackagesBucket(event);
  const downloadedAtBucket = useDownloadedAtBucket(event);
  const cursorBucket = useCursorsBucket(event);

  if (await packagesBucket.hasItem(packageKey)) {
    const stream = await getItemStream(
      event,
      usePackagesBucket.base,
      packageKey,
    );
    const obj = (await packagesBucket.getMeta(
      packageKey,
    )) as unknown as R2Object;

    await downloadedAtBucket.setItem(
      obj.key,
      Date.parse(new Date().toString()),
    );

    setResponseHeader(event, "content-type", "application/tar+gzip");
    // TODO: add HTTP caching
    return stream;
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
