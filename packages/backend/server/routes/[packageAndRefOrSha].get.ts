import { WorkflowData } from "../types";
import { getPackageManifest } from "query-registry";

type Params = Omit<WorkflowData, "sha" | "isPullRequest" | "ref"> & {
  packageAndRefOrSha: string;
};

const githubUrlRegex =
  /(?:git\+)?https?:\/\/github\.com\/([^\/]+\/[^\/]+)\.git/; // TODO: Don't trust this, it's chatgbd :)

function extractOwnerAndRepo(repositoryUrl: string): [string, string] | null {
  const match = repositoryUrl.match(githubUrlRegex);

  if (match) {
    const [owner, repo] = match[1].split("/");
    return [owner, repo];
  } else {
    return null;
  }
}

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const [packageName, refOrSha] = params.packageAndRefOrSha.split("@");

  const manifest = await getPackageManifest(packageName);

  const repository =
    typeof manifest.repository === "string"
      ? manifest.repository
      : manifest.repository?.url;

  if (!repository) {
    throw createError({
      status: 404,
    });
  }

  const match = extractOwnerAndRepo(repository);
  if (!match) {
    throw createError({
      status: 404,
    });
  }
  const [owner, repo] = match;

  sendRedirect(
    event,
    `/${owner}/${repo}/${packageName}@${refOrSha}`,
  );
});
