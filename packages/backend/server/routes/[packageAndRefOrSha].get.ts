import { WorkflowData } from "../types";

type Params = Omit<WorkflowData, "sha" | "isPullRequest" | "ref"> & {
  packageAndRefOrSha: string;
};

interface PackageData {
  repository?: {
    type: string;
    url: string;
  };
}

function extractOwnerAndRepo(repositoryUrl: string): [string, string] {
  const url = new URL(repositoryUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length >= 2) {
    // first one is the owner, the second one is the repo name
    return [parts[1], parts[2]];
  } else {
    throw new Error("Invalid GitHub repository URL");
  }
}

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const [packageName, refOrSha] = params.packageAndRefOrSha.split("@");

  const data: PackageData = await $fetch(
    `https://registry.npmjs.org/${packageName}`,
  );

  const repositoryUrl = data.repository?.url;

  if (!repositoryUrl || !repositoryUrl.startsWith("https://github.com")) {
    throw new Error("GitHub repository not found in package data");
  }

  const [owner, repo] = extractOwnerAndRepo(repositoryUrl);

  return { owner, repo };
});
