import { WorkflowData } from "../types";

export function generateCommitPublishMessage(
  origin: string,
  packageName: string,
  workflowData: WorkflowData
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

export function generatePullRequestPublishMessage(
  origin: string,
  packageName: string,
  workflowData: WorkflowData
) {
  const shaUrl = generatePublishUrl("sha", origin, packageName, workflowData);
  const refUrl = generatePublishUrl("ref", origin, packageName, workflowData);

  return `
Last Commit Build: ${workflowData.sha}

__${packageName}(${workflowData.sha})__:
\`\`\`
npm i ${shaUrl}    
\`\`\`

Pull Request Build: #${workflowData.ref.replace('pr-', '')}

__${packageName}(#${workflowData.ref.replace('pr-', '')})__:
\`\`\`
npm i ${refUrl}    
\`\`\`

`;
}

export function generatePublishUrl(
  base: "sha" | "ref",
  origin: string,
  packageName: string,
  workflowData: WorkflowData
) {
  const url = new URL(
    `/${workflowData.owner}/${workflowData.repo}/${packageName}@${
      base === "sha" ? workflowData.sha : workflowData.ref
    }`,
    origin
  );
  return url;
}
