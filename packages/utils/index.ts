import type { PackageManifest } from "query-registry";

const githubUrlRegex =
  /(?:git\+)?https?:\/\/github\.com\/([^\/]+\/[^\/]+)\.git/; // TODO: Don't trust this, it's chatgbd :)

export function extractOwnerAndRepo(
  repositoryUrl: string,
): [string, string] | null {
  const match = repositoryUrl.match(githubUrlRegex);

  if (match) {
    const [owner, repo] = match[1].split("/");
    return [owner, repo];
  } else {
    return null;
  }
}

export function extractRepository(manifest: PackageManifest) {
  return typeof manifest.repository === "string"
    ? manifest.repository
    : manifest.repository?.url;
}

const commitLength = 7;

/*
 * "09efd0553374ff7d3e62b79378e3184f5eb57571" => "09efd05"
 */
export function abbreviateCommitHash(fullHash: string) {
  return fullHash.substring(0, commitLength);
}

export function isPullRequest(ref: string) {
  return !Number.isNaN(Number(ref))
}
