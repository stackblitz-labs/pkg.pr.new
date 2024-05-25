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
      return `### ${packageName}:
\`\`\`
npm i ${shaUrl}
\`\`\`
`;
    })
    .join("\n");

  const templatesStr = generateTemplatesStr(templates);

  return `
${templatesStr}

${templatesStr.length ? "---" : ""}

## Commit: ${workflowData.sha}

${shaMessages}
`;
}

export function generatePullRequestPublishMessage(
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
      return `### ${packageName}:
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
      return `### ${packageName}:
\`\`\`
npm i ${refUrl}
\`\`\``;
    })
    .join("\n");

  const templatesStr = generateTemplatesStr(templates);

  return `
${templatesStr}

${templatesStr.length ? "---" : ""}

## Commit: ${workflowData.sha}

${shaMessages}

---    

## Pull Request: #${workflowData.ref}

${refMessages}
`;
}

function generateTemplatesStr(templates: Record<string, string>) {
  const entries = Object.entries(templates);
  return entries.length
    ? `
## Templates:

${entries.map(([k, v]) => `\t - [${k}](${v})`).join("\n")}
`
    : "";
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
