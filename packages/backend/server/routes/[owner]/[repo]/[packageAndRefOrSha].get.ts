import { WorkflowData } from "../../../types";
import { abbreviateCommitHash } from "@pkg-pr-new/utils";

type Params = Omit<WorkflowData, "sha" | "ref"> & {
  packageAndRefOrSha: string;
};

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  let [encodedPackageName, longerRefOrSha] = params.packageAndRefOrSha.split("@");
  const packageName = decodeURIComponent(encodedPackageName);
  longerRefOrSha = longerRefOrSha.split('.tgz')[0] // yarn support
  const isSha = isValidGitHash(longerRefOrSha);
  const refOrSha = isSha ? abbreviateCommitHash(longerRefOrSha) : longerRefOrSha;

  let base = `${params.owner}:${params.repo}:${refOrSha}`;
  
  const cursorKey = base;

  const packagesBucket = usePackagesBucket(event);
  const downloadedAtBucket = useDownloadedAtBucket(event);
  const cursorBucket = useCursorsBucket(event);
  // sample full git sha: 0123456789abcdef0123456789abcdef01234567
  // abbreviated 7 chars: 0123456
  // abbreviated 10 chars: 0123456789

  // longer sha support with precision
  if (isSha) {
    const keys = await packagesBucket.getKeys(base);
    for (const key of keys.filter(key => key.endsWith(`:${packageName}`))) {
      const sha = key.split(":")[2];
      console.log(sha)
      if (sha.startsWith(longerRefOrSha)) {
        base = base.replace(refOrSha, longerRefOrSha);
        break;
      }
    }
  }

  const packageKey = `${base}:${packageName}`;

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

const sha1Regex = /^[a-f0-9]{40}$/i;
const sha256Regex = /^[a-f0-9]{64}$/i;

function isValidGitHash(hash: string): boolean {
  return sha1Regex.test(hash) || sha256Regex.test(hash);
}
