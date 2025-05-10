import type { WorkflowData } from "../../../../types";

type Params = Omit<WorkflowData, "sha" | "isPullRequest" | "ref"> & {
  npmOrg: string;
  packageAndRefOrSha: string;
};

export default eventHandler((event) => {
  const params = getRouterParams(event) as Params;
  const [noScopePackageName, refOrSha] = params.packageAndRefOrSha.split("@");
  const packageName = `${params.npmOrg}/${noScopePackageName}`;

  sendRedirect(
    event,
    `/${params.owner}/${params.repo}/${encodeURIComponent(packageName)}@${refOrSha}`,
  );
});
