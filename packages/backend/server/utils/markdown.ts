import { WorkflowData } from "../types";

export function generateCommitPublishMessage(
  origin: string,
  packages: string[],
  workflowData: WorkflowData,
) {
  const shaMessages = packages.map((packageName) => {
    const shaUrl = generatePublishUrl("sha", origin, packageName, workflowData);
    return `__${packageName}__:
\`\`\`
npm i ${shaUrl}    
\`\`\``;
  });

  return `
Last Commit: ${workflowData.sha}

${shaMessages}
`;
}

export function generatePullRequestPublishMessage(
  origin: string,
  packages: string[],
  workflowData: WorkflowData,
) {
  const shaMessages = packages.map((packageName) => {
    const shaUrl = generatePublishUrl("sha", origin, packageName, workflowData);
    return `__${packageName}(${workflowData.sha})__:
\`\`\`
npm i ${shaUrl}    
\`\`\``;
  });

  const refMessages = packages.map((packageName) => {
    const refUrl = generatePublishUrl("ref", origin, packageName, workflowData);
    return `__${packageName}(#${workflowData.ref})__:
\`\`\`
npm i ${refUrl}    
\`\`\``;
  });

  return `
Last Commit Build: ${workflowData.sha}

${shaMessages.join("\n")}
    

Pull Request Build: #${workflowData.ref}

${refMessages.join("\n")}
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
