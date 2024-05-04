import { WorkflowData } from "../types";

export async function generateCommitPublishMessage(
  origin: string,
  packageName: string,
  workflowData: WorkflowData,
) {
  const shaUrl = generatePublishUrl("sha", origin, packageName, workflowData);
  return `
Last Commit: ${workflowData.sha}

__${packageName}__:
\`\`\`
npm i ${shaUrl}    
\`\`\`
    
    `;
}

export async function generatePullRequestPublishMessage(
  origin: string,
  packageName: string,
  workflowData: WorkflowData,
) {
  const shaUrl = generatePublishUrl("sha", origin, packageName, workflowData);
  const refUrl = generatePublishUrl("ref", origin, packageName, workflowData);

  return `
Last Commit Build: ${workflowData.sha}

__${packageName}(${workflowData.sha})__:
\`\`\`
npm i ${shaUrl}    
\`\`\`

Pull Request Build: #${workflowData.ref.replace("pr-", "")}

__${packageName}(#${workflowData.ref.replace("pr-", "")})__:
\`\`\`
npm i ${refUrl}    
\`\`\`

`;
}

export async function generatePublishUrl(
  base: "sha" | "ref",
  origin: string,
  packageName: string,
  workflowData: WorkflowData,
) {
  const npmRegistryUrl = `https://registry.npmjs.org/${packageName}`;
  const response = await fetch(npmRegistryUrl);
  const packageInfo: any = await response.json();
  const githubRepoUrl = packageInfo.repository?.url;
  if (!githubRepoUrl) {
    throw new Error(
      `GitHub repository URL not found for package: ${packageName}`,
    );
  }

  // const shorter = workflowData.repo === packageName;
  const ref = base === "sha" ? workflowData.sha : workflowData.ref;
  const url = new URL(`${githubRepoUrl}/tree/${ref}`, origin);

  // const url = new URL(
  //   `/${workflowData.owner}/${workflowData.repo}${shorter ? "" : "/" + packageName}@${
  //     base === "sha" ? workflowData.sha : workflowData.ref
  //   }`,
  //   origin,
  // );
  return url;
}
