import { WorkflowData } from "../types";

export function generateCommitPublishMessage(
  origin: string,
  packageName: string,
  workflowData: WorkflowData
) {
  console.log(origin, workflowData)
  const url = new URL(
    `/${workflowData.orgOrAuthor}/${workflowData.repo}/${workflowData.ref}/${workflowData.sha}/${packageName}`,
    origin
  );
  return `
    <table role="table"><tbody><tr><td><strong>Commit:</strong> </td><td>
<code class="notranslate">${workflowData.sha}</code>
</td></tr>
<a href="${url}" rel="nofollow">${url}</a>
</td></tr>
</td></tr>
</tbody></table>

<code class="notranslate">npm i ${url}</code>
    `;
}
