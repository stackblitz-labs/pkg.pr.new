import {
  extractOwnerAndRepo,
  extractRepository,
  isValidGitHash,
} from "@pkg-pr-new/utils";
import { getPackageManifest } from "query-registry";
import { normalizeKey } from "unstorage";

const RESERVED_ROUTES = new Set(["api", "~"]);
const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

export default eventHandler(async (event) => {
  let decodedPath: string;
  try {
    const path = event.path
      .split("?")[0]
      // yarn support
      .replace(/\.tgz$/, "");
    decodedPath = decodeURIComponent(path);
  } catch {
    throw createError({
      statusCode: 400,
      message: "Malformed URI",
    });
  }

  let separatorIndex = -1;

  for (let i = 2; i < decodedPath.length - 1; i++) {
    if (decodedPath[i] === "@" && decodedPath[i - 1] !== "/") {
      separatorIndex = i;
      break;
    }
  }

  if (separatorIndex === -1) return;

  let refOrSha = decodedPath.slice(separatorIndex + 1);

  const pathSegments = decodedPath
    .slice(0, separatorIndex)
    .split("/")
    .filter(Boolean);
  if (pathSegments.length === 0) return;

  const rootSegment = pathSegments[0];
  if (RESERVED_ROUTES.has(rootSegment) || !/^[a-z0-9@]/i.test(rootSegment)) {
    return;
  }
  if (!ALLOWED_METHODS.has(event.method)) return;

  let packageName = pathSegments.pop()!;

  if (pathSegments.at(-1)?.startsWith("@")) {
    packageName = `${pathSegments.pop()}/${packageName}`;
  }

  let owner = pathSegments.shift();
  let repo = pathSegments.shift() ?? (owner ? packageName : undefined);

  if (pathSegments.length > 0) return;

  if (!repo) {
    try {
      const manifest = await getPackageManifest(packageName);

      const repository = extractRepository(manifest);
      if (!repository) throw new Error();

      const match = extractOwnerAndRepo(repository);
      if (!match) throw new Error();

      [owner, repo] = match;
    } catch {
      throw createError({
        statusCode: 404,
        message: "Registry or repository not found",
      });
    }
  }

  const isFullGitHash = isValidGitHash(refOrSha);
  if (!isFullGitHash) {
    const cursorBucket = useCursorsBucket(event);
    const cursorKey = `${owner}:${repo}:${refOrSha}`;
    const currentCursor = await cursorBucket.getItem(cursorKey);

    if (currentCursor) {
      refOrSha = currentCursor.sha;
    }
  }

  const repositoryCommitKey = `${owner}:${repo}:${refOrSha}`;
  setResponseHeader(event, "x-commit-key", repositoryCommitKey);

  const normalizedPkgName = normalizeKey(packageName);
  setResponseHeader(event, "x-pkg-name-key", normalizedPkgName);

  const prefix = `${usePackagesBucket.base}:${repositoryCommitKey}`;

  const binding = useBinding(event);
  const { objects } = await binding.list({ prefix });

  const packageMetadata = objects.find(({ key }) => {
    // bucket:package:stackblitz-labs:pkg.pr.new:ded05e838c418096e5dd77a29101c8af9e73daea:playground-b
    if (!key.endsWith(normalizedPkgName)) return false;

    // ...:playground-b
    const remainder = key.slice(prefix.length);
    const colonIdx = remainder.indexOf(":");

    return remainder.slice(colonIdx + 1) === normalizedPkgName;
  });

  if (!packageMetadata) {
    throw createError({
      statusCode: 404,
      message: "Pkg not found",
    });
  }

  setResponseHeader(event, "content-type", "application/tar+gzip");
  setResponseHeader(event, "etag", packageMetadata.etag);
  setResponseHeader(
    event,
    "last-modified",
    packageMetadata.uploaded.toUTCString(),
  );

  if (event.method === "HEAD") {
    setResponseStatus(event, 200);
    return send(event, null);
  }

  const downloadedAtBucket = useDownloadedAtBucket(event);
  event.waitUntil(downloadedAtBucket.setItem(packageMetadata.key, Date.now()));

  const object = await binding.get(packageMetadata.key);
  const stream = object?.body;

  // TODO: add HTTP caching
  return stream;
});
