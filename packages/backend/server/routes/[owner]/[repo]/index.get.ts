import { WorkflowData } from "../../../types";

type Params = Omit<WorkflowData, "sha" | "isPullRequest" | "ref">;

// https://pkg.pr.new/tinylibs/tinybench@a832a55
export default eventHandler(async (event) => {
  const params = getRouterParams(event) as Params;
  const [packageName, refOrSha] = params.repo.split("@");

  // -> https://pkg.pr.new/tinylibs/tinybench/tinybench@a832a55
  sendRedirect(
    event,
    `/${params.owner}/${params.repo}/${packageName}@${refOrSha}`,
  );
});
