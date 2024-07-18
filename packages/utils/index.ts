import GitHost from "hosted-git-info";
import type { PackageManifest } from "query-registry";

export function extractOwnerAndRepo(
  repositoryUrl: string,
): [owner: string, repo: string] | null {
  const { type, user, project } = GitHost.fromUrl(repositoryUrl.replace(/^git\+/, "")) ?? {};

  if (type === "github" && user && project) {
    return [user, project];
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
export type PackageManager = "npm" | "pnpm" | "yarn";
