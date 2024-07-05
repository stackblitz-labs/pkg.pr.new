import { abbreviateCommitHash } from "@pkg-pr-new/utils";
import { WorkflowData } from "../types";
import * as fs from "fs";
import * as path from "path";

export function detectPackageManager(rootPath: string): "npm" | "pnpm" {
  if (fs.existsSync(path.join(rootPath, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (
    fs.existsSync(path.join(rootPath, "package-lock.json")) ||
    fs.existsSync(path.join(rootPath, "npm-shrinkwrap.json"))
  ) {
    return "npm";
  }
  return "npm";
}

export function generateCommitPublishMessage(
  origin: string,
  templates: Record<string, string>,
  packages: string[],
  workflowData: WorkflowData,
  compact: boolean,
  packageManager: string,
) {
  // const packageManager = detectPackageManager(".");
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
${packageManager} ${packageManager === "npm" ? "i" : "add"} ${shaUrl}
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
  packageManager: string,
  base: "sha" | "ref",
) {
  // const packageManager = detectPackageManager(".");
  const refMessages = packages
    .map((packageName) => {
      const refUrl = generatePublishUrl(
        base,
        origin,
        packageName,
        workflowData,
        compact,
      );

      return createCollapsibleBlock(
        `<b>${packageName}</b>`,
        `
\`\`\`
${packageManager} ${packageManager === "npm" ? "i" : "add"} ${refUrl}
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
        "<b>templates</b>",
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
