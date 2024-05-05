import { WorkflowData } from "../types";
import { getPackageManifest } from "query-registry";
import { extractOwnerAndRepo, extractRepository } from "@pkg-pr-new/utils";

type Params = Omit<WorkflowData, "sha" | "isPullRequest" | "ref"> & {
  packageAndRefOrSha: string;
};

export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const [packageName, refOrSha] = params.packageAndRefOrSha.split("@");

  const manifest = await getPackageManifest(packageName);

  const repository = extractRepository(manifest);
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

  sendRedirect(event, `/${owner}/${repo}/${packageName}@${refOrSha}`);
});
