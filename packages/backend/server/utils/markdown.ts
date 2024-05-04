import { WorkflowData } from "../types";

export async function generateCommitPublishMessage(
  origin: string,
  packages: string[],
  workflowData: WorkflowData,
) {
  const shaUrlsPromises = packages.map((packageName) =>
    generatePublishUrl("sha", origin, packageName, workflowData),
  );
  const shaUrls = await Promise.all(shaUrlsPromises);

  const shaMessages = packages.map((packageName, index) => {
    return `__${packageName}__:
\`\`\`
npm i ${shaUrls[index]}    
\`\`\``;
  });

  return `
Last Commit: ${workflowData.sha}

${shaMessages.join("\n")}
`;
}

export async function generatePullRequestPublishMessage(
  origin: string,
  packages: string[],
  workflowData: WorkflowData,
) {
  const shaUrlsPromises = packages.map((packageName) =>
    generatePublishUrl("sha", origin, packageName, workflowData),
  );
  const refUrlsPromises = packages.map((packageName) =>
    generatePublishUrl("ref", origin, packageName, workflowData),
  );
  const [shaUrls, refUrls] = await Promise.all([
    Promise.all(shaUrlsPromises),
    Promise.all(refUrlsPromises),
  ]);

  const shaMessages = packages.map((packageName, index) => {
    return `__${packageName}(${workflowData.sha})__:
\`\`\`
npm i ${shaUrls[index]}    
\`\`\``;
  });

  const refMessages = packages.map((packageName, index) => {
    return `__${packageName}(#${workflowData.ref})__:
\`\`\`
npm i ${refUrls[index]}    
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
