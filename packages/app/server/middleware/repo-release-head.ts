import { hasRepoReleases } from "../utils/bucket";

const REPO_HEAD_PATH = /^\/~\/([^/]+)\/([^/]+)\/?$/;

export default eventHandler(async (event) => {
  if (event.method !== "HEAD") return;

  let pathname: string;
  try {
    pathname = decodeURIComponent(getRequestURL(event).pathname);
  } catch {
    return;
  }

  const match = pathname.match(REPO_HEAD_PATH);
  if (!match) return;

  const owner = match[1]?.trim();
  const repo = match[2]?.trim();
  if (!owner || !repo) return;

  const exactMatch = await hasRepoReleases(event, owner, repo);
  const normalizedMatch =
    exactMatch ||
    (await hasRepoReleases(event, owner.toLowerCase(), repo.toLowerCase()));

  setHeader(
    event,
    "Cache-Control",
    "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
  );
  setHeader(event, "x-has-releases", normalizedMatch ? "1" : "0");
  setResponseStatus(event, normalizedMatch ? 200 : 404);
  return send(event, null);
});
