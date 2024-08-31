import {
  Comment,
  abbreviateCommitHash,
  isPullRequest,
} from "@pkg-pr-new/utils";
import { randomUUID } from "uncrypto";
import { setItemStream, useTemplatesBucket } from "~/utils/bucket";
import { useOctokitInstallation } from "~/utils/octokit";
import { generateTemplateHtml } from "~/utils/template";
import type { PackageManager } from "@pkg-pr-new/utils";
import type { components as OctokitComponents } from "@octokit/openapi-types";

export default eventHandler(async (event) => {
  const origin = getRequestURL(event).origin;
  const {
    "sb-run-id": runIdHeader,
    "sb-key": key,
    "sb-shasums": shasumsHeader,
    "sb-comment": commentHeader,
    "sb-compact": compactHeader,
    "sb-package-manager": packageManagerHeader,
    "sb-only-templates": onlyTemplatesHeader,
  } = getHeaders(event);
  const compact = compactHeader === "true";
  const onlyTemplates = onlyTemplatesHeader === "true";
  const comment: Comment = (commentHeader ?? "update") as Comment;
  const packageManager: PackageManager =
    (packageManagerHeader as PackageManager) || "npm";

  if (!key || !runIdHeader || !shasumsHeader) {
    throw createError({
      statusCode: 400,
      message:
        "sb-commit-timestamp, sb-key and sb-shasums headers are required",
    });
  }
  const runId = Number(runIdHeader);
  const workflowsBucket = useWorkflowsBucket(event);
  const workflowData = (await workflowsBucket.getItem(key))!;

  const whitelisted = await isWhitelisted(
    workflowData.owner,
    workflowData.repo,
  );
  const contentLength = Number(getHeader(event, "content-length"));

  // 20mb limit for now
  if (!whitelisted && contentLength > 1024 * 1024 * 20) {
    // Payload too large
    throw createError({
      statusCode: 413,
      message:
        "Max payload limit is 20mb! Feel free to apply for the whitelist: https://github.com/stackblitz-labs/pkg.pr.new/blob/main/.whitelist",
    });
  }

  const shasums: Record<string, string> = JSON.parse(shasumsHeader);
  const formData = await readFormData(event);
  const packages = [...formData.keys()].filter((k) => k.startsWith("package:"));
  const packagesWithoutPrefix = packages.map((p) => p.slice("package:".length));
  const templateAssets = [...formData.keys()].filter((k) =>
    k.startsWith("template:"),
  );

  if (!packages.length) {
    throw createError({
      statusCode: 400,
      message: "No packages",
    });
  }

  const { appId } = useRuntimeConfig(event);
  const cursorBucket = useCursorsBucket(event);

  if (!(await workflowsBucket.hasItem(key))) {
    throw createError({
      statusCode: 401,
      message:
        "Try publishing from a github workflow! Also make sure you install https://github.com/apps/pkg-pr-new Github app on the repo",
    });
  }

  const abbreviatedSha = abbreviateCommitHash(workflowData.sha);
  const baseKey = `${workflowData.owner}:${workflowData.repo}`;

  const cursorKey = `${baseKey}:${workflowData.ref}`;

  const currentCursor = await cursorBucket.getItem(cursorKey);

  await Promise.all(
    packages.map(async (packageNameWithPrefix) => {
      const file = formData.get(packageNameWithPrefix)! as File;
      const packageName = packageNameWithPrefix.slice("package:".length);

      const packageKey = `${baseKey}:${abbreviatedSha}:${packageName}`;

      const stream = file.stream();
      return setItemStream(event, usePackagesBucket.base, packageKey, stream, {
        sha1: shasums[packageName],
      });
    }),
  );

  const templatesMap = new Map<string, Record<string, string>>();

  await Promise.all(
    templateAssets.map(async (templateAssetWithPrefix) => {
      const file = formData.get(templateAssetWithPrefix)!;
      const [template, encodedTemplateAsset] = templateAssetWithPrefix
        .slice("template:".length)
        .split(":");
      const templateAsset = decodeURIComponent(encodedTemplateAsset);

      const isBinary = !(typeof file === "string");
      const uuid = randomUUID();

      templatesMap.set(template, {
        ...templatesMap.get(template),
        [templateAsset]: isBinary
          ? new URL(`/template/${uuid}`, origin).href
          : file,
      });

      if (isBinary) {
        const stream = file.stream();
        return setItemStream(event, useTemplatesBucket.base, uuid, stream);
      }
    }),
  );

  const templatesBucket = useTemplatesBucket(event);

  const textEncoder = new TextEncoder();
  const templatesHtmlMap: Record<string, string> = {};

  for (const [template, files] of templatesMap) {
    const html = generateTemplateHtml(template, files);
    const uuid = randomUUID();
    await templatesBucket.setItemRaw(uuid, textEncoder.encode(html));
    templatesHtmlMap[template] = new URL(`/template/${uuid}`, origin).href;
  }

  if (!currentCursor || currentCursor.timestamp < runId) {
    await cursorBucket.setItem(cursorKey, {
      sha: abbreviatedSha,
      timestamp: runId,
    });
  }

  await workflowsBucket.removeItem(key);

  const installation = await useOctokitInstallation(
    event,
    workflowData.owner,
    workflowData.repo,
  );

  const checkName = "Continuous Releases";
  const {
    data: { check_runs },
  } = await installation.request(
    "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
    {
      check_name: checkName,
      owner: workflowData.owner,
      repo: workflowData.repo,
      ref: workflowData.sha,
      app_id: Number(appId),
    },
  );

  let checkRunUrl = check_runs[0]?.html_url ?? "";

  if (!check_runs.length) {
    const {
      data: { html_url },
    } = await installation.request("POST /repos/{owner}/{repo}/check-runs", {
      name: checkName,
      owner: workflowData.owner,
      repo: workflowData.repo,
      head_sha: workflowData.sha,
      output: {
        title: "Successful",
        summary: "Published successfully.",
        text: generateCommitPublishMessage(
          origin,
          templatesHtmlMap,
          packagesWithoutPrefix,
          workflowData,
          compact,
          packageManager,
        ),
      },
      conclusion: "success",
    });
    checkRunUrl = html_url!;
  }

  if (isPullRequest(workflowData.ref)) {
    let prevComment: OctokitComponents["schemas"]["issue-comment"];

    await installation.paginate(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: workflowData.owner,
        repo: workflowData.repo,
        issue_number: Number(workflowData.ref),
      },
      ({ data }, done) => {
        for (const c of data) {
          if (c.performed_via_github_app?.id === Number(appId)) {
            prevComment = c;
            done();
            break
          }
        }
        return [];
      },
    );

    if (comment !== "off") {
      if (comment === "update" && prevComment!) {
        await installation.request(
          "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
          {
            owner: workflowData.owner,
            repo: workflowData.repo,
            comment_id: prevComment.id,
            body: generatePullRequestPublishMessage(
              origin,
              templatesHtmlMap,
              packagesWithoutPrefix,
              workflowData,
              compact,
              onlyTemplates,
              checkRunUrl,
              packageManager,
              "ref",
            ),
          },
        );
      } else {
        await installation.request(
          "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
          {
            owner: workflowData.owner,
            repo: workflowData.repo,
            issue_number: Number(workflowData.ref),
            body: generatePullRequestPublishMessage(
              origin,
              templatesHtmlMap,
              packagesWithoutPrefix,
              workflowData,
              compact,
              onlyTemplates,
              checkRunUrl,
              packageManager,
              comment === "update" ? "ref" : "sha",
            ),
          },
        );
      }
    }
  }

  return {
    ok: true,
    urls: packagesWithoutPrefix.map(
      (packageName) =>
        generatePublishUrl("sha", origin, packageName, workflowData, compact),
    ),
  };
});

const whitelist =
  "https://raw.githubusercontent.com/stackblitz-labs/pkg.pr.new/main/.whitelist";

async function isWhitelisted(owner: string, repo: string) {
  const combination = `${owner}/${repo}`;

  try {
    const response = await fetch(whitelist);
    const content = await response.text();

    return content.includes(combination);
  } catch {
    return false;
  }
}
