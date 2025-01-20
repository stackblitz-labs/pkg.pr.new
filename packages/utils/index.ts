import type { PackageManifest } from "query-registry";

const githubUrlRegex =
  /^(?:git\+)?https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\.git$/;

export function extractOwnerAndRepo(
  repositoryUrl: string,
): [string, string] | null {
  const match = repositoryUrl.match(githubUrlRegex);

  if (match) {
    return [match[1], match[2]];
  }

  return null;
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
  return !Number.isNaN(Number(ref));
}

export type Comment = "off" | "create" | "update";
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const whitelist =
  "https://raw.githubusercontent.com/stackblitz-labs/pkg.pr.new/main/.whitelist";

export async function isWhitelisted(owner: string, repo: string) {
  const combination = `${owner}/${repo}`;

  try {
    const response = await fetch(whitelist);
    const content = await response.text();

    return content.includes(combination);
  } catch {
    return false;
  }
}
