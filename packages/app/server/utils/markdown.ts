import type { PackageManager } from "@pkg-pr-new/utils";
import type { WorkflowData } from "../types";
import { abbreviateCommitHash } from "@pkg-pr-new/utils";

const installCommands: Record<PackageManager, string> = {
  npm: "npm i",
  pnpm: "pnpm add",
  yarn: "yarn add",
  bun: "bun add",
};

const binCommands: Record<PackageManager, string> = {
  npm: "npx",
  pnpm: "pnpm dlx",
  yarn: "npx",
  bun: "bunx",
};

export function generateCommitPublishMessage(
  origin: string,
  templates: Record<string, string>,
  packages: string[],
  workflowData: WorkflowData,
  compact: boolean,
  packageManager: PackageManager,
  bin: boolean,
  commentWithDev: boolean,
) {
  const isMoreThanFour = packages.length > 4;
  const shaMessages = packages
    .map((packageName) => {
      let shaUrl = generatePublishUrl(
        "sha",
        origin,
        packageName,
        workflowData,
        compact,
      );
      return packageManager
        .split(",")
        .map((pm) => {
          if (pm === "yarn") {
            shaUrl = `${shaUrl}.tgz`;
          }

          const descriptor = `${pm === "yarn" ? `${packageName}@` : ""}${shaUrl + (commentWithDev ? " -D" : "")}`;

          return `
  \`\`\`
  ${bin ? binCommands[pm as PackageManager] : installCommands[pm as PackageManager]} ${descriptor}
  \`\`\`
        `;
        })
        .join("\n");
    })
    .map((message, i) =>
      isMoreThanFour
        ? createCollapsibleBlock(`<b>${packages[i]}</b>`, message)
        : message,
    )
    .join("\n");

  const templatesStr = generateTemplatesStr(templates);

  return `
${templatesStr}

${shaMessages}
`;
}

export function generatePullRequestPublishMessage(
  origin: string,
  templates: Record<string, string>,
  packages: string[],
  workflowData: WorkflowData,
  compact: boolean,
  onlyTemplates: boolean,
  checkRunUrl: string,
  packageManager: PackageManager,
  base: "sha" | "ref",
  bin: boolean,
  commentWithDev: boolean,
) {
  const isMoreThanFour = packages.length > 4;
  const refMessages = packages
    .map((packageName) => {
      let refUrl = generatePublishUrl(
        base,
        origin,
        packageName,
        workflowData,
        compact,
      );
      return packageManager
        .split(",")
        .map((pm) => {
          if (pm === "yarn") {
            refUrl = `${refUrl}.tgz`;
          }

          return `
  \`\`\`
  ${bin ? binCommands[pm as PackageManager] : installCommands[pm as PackageManager]} ${refUrl + (commentWithDev ? " -D" : "")}
  \`\`\`
  `;
        })
        .join("\n");
    })
    .map((message, i) =>
      isMoreThanFour
        ? createCollapsibleBlock(`<b>${packages[i]}</b>`, message)
        : message,
    )
    .join("\n");

  const templatesStr = generateTemplatesStr(templates);

  return `
${templatesStr}

${onlyTemplates ? "" : refMessages}

_commit: <a href="${checkRunUrl}"><code>${abbreviateCommitHash(workflowData.sha)}</code></a>_
`;
}

function generateTemplatesStr(templates: Record<string, string>) {
  const entries = Object.entries(templates).filter(([k]) => k !== "default");
  let str =
    entries.length === 0 && templates.default
      ? `[Open in StackBlitz](${templates.default})`
      : "";

  if (entries.length > 0 && entries.length <= 2) {
    str = [str, ...entries.map(([k, v]) => `- [${k}](${v})`)]
      .filter(Boolean)
      .join("\n");
  } else if (entries.length > 2) {
    str += createCollapsibleBlock(
      "<b>More templates</b>",
      `
${entries.map(([k, v]) => `- [${k}](${v})`).join("\n")}
`,
    );
  }
  return str;
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

  return `${new URL(urlPath, origin)}`;
}

function createCollapsibleBlock(title: string, body: string) {
  return `
<details><summary>${title}</summary><p>
${body}
</p></details>

    `;
}
