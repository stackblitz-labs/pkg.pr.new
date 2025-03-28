import { abbreviateCommitHash, PackageManager } from "@pkg-pr-new/utils";
import { WorkflowData } from "../types";

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

      if (packageManager === "yarn") {
        shaUrl = shaUrl + ".tgz";
      }

      return `
\`\`\`
${bin ? binCommands[packageManager] : installCommands[packageManager]} ${shaUrl}
\`\`\`
      `;
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

      if (packageManager === "yarn") {
        refUrl = refUrl + ".tgz";
      }

      return `
\`\`\`
${bin ? binCommands[packageManager] : installCommands[packageManager]} ${refUrl}
\`\`\`
`;
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
  const actualEntries = Object.entries(templates).filter(
    ([k]) => k !== "default" && !k.startsWith("example-"),
  );
  const exampleEntries = Object.entries(templates).filter(([k]) =>
    k.startsWith("example-"),
  );

  let str =
    actualEntries.length === 0 && templates.default
      ? `[Open in StackBlitz](${templates.default})`
      : "";

  const allEntries = [...actualEntries, ...exampleEntries];
  if (allEntries.length > 0 && allEntries.length <= 2) {
    str = [str, ...allEntries.map(([k, v]) => `[${k}](${v})`)]
      .filter(Boolean)
      .join(" • ");
  } else if (allEntries.length > 2) {
    str += createCollapsibleBlock(
      "<b>More templates</b>",
      `
${allEntries.map(([k, v]) => `- [${k}](${v})`).join("\n")}
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
