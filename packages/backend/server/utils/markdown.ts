import { WorkflowData } from "../types";

export function generateCommitPublishMessage(
  origin: string,
  packageName: string,
  workflowData: WorkflowData
) {
  const url = new URL(
    `/${workflowData.owner}/${workflowData.repo}/${workflowData.ref}/${workflowData.sha}/${packageName}`,
    origin
  );
  return `
Last Commit: \`${workflowData.sha}\`

__${packageName}__:
\`\`\`
npm i ${url}    
\`\`\`
    
    `;
}

export function generatePullRequestPublishMessage(
  origin: string,
  packageName: string,
  workflowData: WorkflowData
) {
  const url = new URL(
    `/${workflowData.owner}/${workflowData.repo}/${workflowData.ref}/${workflowData.sha}/${packageName}`,
    origin
  );
  return `
Last Commit Build: \`${workflowData.sha}\`

__${packageName}(${workflowData.sha})__:
\`\`\`
npm i ${url}    
\`\`\`

Pull Request Build: \`${workflowData.ref}\`

__${packageName}(${workflowData.ref})__:
\`\`\`
npm i ${url.href.replace(`/${workflowData.sha}`, '')}    
\`\`\`

`;
}
