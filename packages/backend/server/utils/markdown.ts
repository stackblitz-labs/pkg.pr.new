import { abbreviateCommitHash } from "@pkg-pr-new/utils";
import { WorkflowData } from "../types";

export function generateCommitPublishMessage(
  origin: string,
  templates: Record<string, string>,
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
      return createCollapsibleBlock(
        `<b>${packageName}</b>`,
        `
\`\`\`
npm i ${shaUrl}
\`\`\`
      `,
      );
    })
    .join("\n");

  const templatesStr = generateTemplatesStr(templates);

  return `
${shaMessages}

${templatesStr ? "---" : ""}

${templatesStr}
`;
}

export function generatePullRequestPublishMessage(
  origin: string,
  templates: Record<string, string>,
  packages: string[],
  workflowData: WorkflowData,
  compact: boolean,
  checkRunUrl: string,
  codeflow: boolean,
) {
  const refMessages = packages
    .map((packageName) => {
      const refUrl = generatePublishUrl(
        "ref",
        origin,
        packageName,
        workflowData,
        compact,
      );

      return createCollapsibleBlock(
        `<b>${packageName}</b>`,
        `
\`\`\`
npm i ${refUrl}
\`\`\`
`,
      );
    })
    .join("\n");

  const templatesStr = generateTemplatesStr(templates);

  return `
${
  codeflow
    ? `<a href="https:///pr.new/${workflowData.owner}/${workflowData.repo}/pull/${workflowData.ref}"><img src="https://developer.stackblitz.com/img/review_pr_small.svg" alt="Review PR in StackBlitz Codeflow" align="left" width="103" height="20"></a> _Run & review this pull request in [StackBlitz Codeflow](https:///pr.new/${workflowData.owner}/${workflowData.repo}/pull/${workflowData.ref})._`
    : ""
}

_commit: <a href="${checkRunUrl}"><code>${abbreviateCommitHash(workflowData.sha)}</code></a>_

${refMessages}

${templatesStr ? "---" : ""}

${templatesStr}
`;
}

function generateTemplatesStr(templates: Record<string, string>) {
  const entries = Object.entries(templates);
  return entries.length
    ? createCollapsibleBlock(
        "<b>Templates</b>",
        `
${entries.map(([k, v]) => `- [${k}](${v})`).join("\n")}
`,
      )
    : "";
}

export function generatePublishUrl(
  base: "sha" | "ref",
  origin: string,
  packageName: string,
  workflowData: WorkflowData,
  compact: boolean,
) {
  const tag =
    base === "sha" ? abbreviateCommitHash(workflowData.sha) : workflowData.ref;
  const shorter = workflowData.repo === packageName;

  const urlPath = compact
    ? `/${packageName}@${tag}`
    : `/${workflowData.owner}${shorter ? "" : `/${workflowData.repo}`}/${packageName}@${tag}`;

  return new URL(urlPath, origin);
}

function createCollapsibleBlock(title: string, body: string) {
  return `
<details><summary>${title}</summary><p>
${body}
</p></details>
      
    `;
}
