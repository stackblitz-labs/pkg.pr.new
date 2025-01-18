import { WorkflowData } from "../../../types";
import { abbreviateCommitHash } from "@pkg-pr-new/utils";
import { normalizeKey } from "unstorage";

type Params = Omit<WorkflowData, "sha" | "ref"> & {
  packageAndRefOrSha: string;
};

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  let [encodedPackageName, longerRefOrSha] =
    params.packageAndRefOrSha.split("@");
  const packageName = decodeURIComponent(encodedPackageName);
  longerRefOrSha = longerRefOrSha.split(".tgz")[0]; // yarn support
  const isSha = isValidGitHash(longerRefOrSha);
  const refOrSha = isSha
    ? abbreviateCommitHash(longerRefOrSha)
    : longerRefOrSha;

  let base = `${params.owner}:${params.repo}:${refOrSha}`;
  let packageKey = `${base}:${packageName}`;

  const cursorKey = base;

  const packagesBucket = usePackagesBucket(event);
  const downloadedAtBucket = useDownloadedAtBucket(event);
  const cursorBucket = useCursorsBucket(event);

  if (await cursorBucket.hasItem(cursorKey)) {
    const currentCursor = (await cursorBucket.getItem(cursorKey))!;

    sendRedirect(
      event,
      `/${params.owner}/${params.repo}/${packageName}@${currentCursor.sha}`,
    );
    return;
  }

  // longer sha support with precision
  const binding = useBinding(event);
  const { objects } = await binding.list({
    prefix: `${usePackagesBucket.base}:${base}`,
  });
  for (const { key } of objects) {
    // bucket:package:stackblitz-labs:pkg.pr.new:ded05e838c418096e5dd77a29101c8af9e73daea:playground-b
    const trimmedKey = key.slice(usePackagesBucket.base.length + 1);

    // https://github.com/unjs/unstorage/blob/e42c01d0c22092f394f57e3ec114371fc8dcf6dd/src/drivers/utils/index.ts#L14-L19
    const [keySha, ...keyPackageNameParts] = trimmedKey.split(":").slice(2);
    const keyPackageName = keyPackageNameParts.join(":");
    if (keyPackageName !== normalizeKey(packageName)) continue;

    if (keySha.startsWith(longerRefOrSha)) {
      packageKey = trimmedKey;
      break;
    }
  }

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
  }

  throw createError({
    status: 404,
  });
});

const sha1Regex = /^[a-f0-9]{40}$/i;
const sha256Regex = /^[a-f0-9]{64}$/i;

function isValidGitHash(hash: string): boolean {
  return sha1Regex.test(hash) || sha256Regex.test(hash);
}
