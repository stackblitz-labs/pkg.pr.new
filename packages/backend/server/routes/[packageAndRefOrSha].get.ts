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
  const ownerAndRepo = parts.slice(1, 3);
  if (ownerAndRepo.length === 2) {
    return ownerAndRepo;
  } else {
    throw createError({
      status: 404,
    });
  }
}

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const [packageName, refOrSha] = params.packageAndRefOrSha.split("@");

  const data: PackageData = await $fetch(
    `https://registry.npmjs.org/${packageName}`,
  );

  const repositoryUrl = data.repository?.url;

  if (!repositoryUrl) {
    throw createError({
      status: 404,
    });
  }

  const [owner, repo] = extractOwnerAndRepo(repositoryUrl);

  return { owner, repo };
});
