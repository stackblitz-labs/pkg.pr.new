import { abbreviateCommitHash, PackageManager } from "@pkg-pr-new/utils";
import { WorkflowData } from "../types";

const packageCommands: Record<PackageManager, string> = {
  npm: "i",
  pnpm: "add",
  yarn: "add",
};

export function generateCommitPublishMessage(
  origin: string,
  templates: Record<string, string>,
  packages: string[],
  workflowData: WorkflowData,
  compact: boolean,
  packageManager: PackageManager,
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
      return `
\`\`\`
${packageManager} ${packageCommands[packageManager]} ${shaUrl}
\`\`\`
      `;
    })
    .join("\n");

  const templatesStr = generateTemplatesStr(templates);

  return `
${shaMessages}

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
  packageManager: PackageManager,
  base: "sha" | "ref",
) {
  const refMessages = packages
    .map((packageName) => {
      const refUrl = generatePublishUrl(
        base,
        origin,
        packageName,
        workflowData,
        compact,
      );

      return `
\`\`\`
${packageManager} ${packageCommands[packageManager]} ${refUrl}
\`\`\`
`;
    })
    .join("\n");

  const templatesStr = generateTemplatesStr(templates);

  return `
_commit: <a href="${checkRunUrl}"><code>${abbreviateCommitHash(workflowData.sha)}</code></a>_

${refMessages}

${templatesStr}
`;
}

function generateTemplatesStr(templates: Record<string, string>) {
  const entries = Object.entries(templates).filter(([k]) => k !== "default");
  return `
[Open in Stackblitz](${templates["default"]})
    ` + entries.length
    ? createCollapsibleBlock(
        "<b>More templates</b>",
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
