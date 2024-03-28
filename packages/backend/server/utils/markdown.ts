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
Commit: \`${workflowData.sha}\`

\`\`\`
npm i ${url}    
\`\`\`
    
    `;
}
