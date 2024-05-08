import { WorkflowData } from "../types";

export function generateCommitPublishMessage(
  origin: string,
  packages: string[],
  workflowData: WorkflowData,
  compact: boolean,
) {
  const shaMessages = packages
    .map((packageName) => {
      const shaUrl = generatePublishUrl(
        "sha",
        origin,
        packageName,
        workflowData,
        compact,
      );
      return `__${packageName}__:
\`\`\`
npm i ${shaUrl}    
\`\`\`
`;
    })
    .join("\n");

  return `
Last Commit: ${workflowData.sha}

${shaMessages}
`;
}

export function generatePullRequestPublishMessage(
  origin: string,
  packages: string[],
  workflowData: WorkflowData,
  compact: boolean,
) {
  const shaMessages = packages
    .map((packageName) => {
      const shaUrl = generatePublishUrl(
        "sha",
        origin,
        packageName,
        workflowData,
        compact,
      );
      return `__${packageName}(${workflowData.sha})__:
\`\`\`
npm i ${shaUrl}    
\`\`\``;
    })
    .join("\n");

  const refMessages = packages
    .map((packageName) => {
      const refUrl = generatePublishUrl(
        "ref",
        origin,
        packageName,
        workflowData,
        compact,
      );
      return `__${packageName}(#${workflowData.ref})__:
\`\`\`
npm i ${refUrl}    
\`\`\``;
    })
    .join("\n");

  return `
Last Commit Build: ${workflowData.sha}

${shaMessages}
    

Pull Request Build: #${workflowData.ref}

${refMessages}
`;
}

export function generatePublishUrl(
  base: "sha" | "ref",
  origin: string,
  packageName: string,
  workflowData: WorkflowData,
  compact: boolean,
) {
  const tag = base === "sha" ? workflowData.sha : workflowData.ref;
  const shorter = workflowData.repo === packageName;

  const urlPath = compact
    ? `/${packageName}@${tag}`
    : `/${workflowData.owner}${shorter ? "" : `/${workflowData.repo}`}/${packageName}@${tag}`;

  return new URL(urlPath, origin);
}
