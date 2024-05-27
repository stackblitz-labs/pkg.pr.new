import { abbreviateCommitHash, isPullRequest } from "@pkg-pr-new/utils";
import { randomUUID } from "uncrypto";
import { setItemStream, useTemplatesBucket } from "~/utils/bucket";
import { generateTemplateHtml } from "~/utils/template";

export default eventHandler(async (event) => {
  const origin = getRequestURL(event).origin;
  const contentLength = Number(getHeader(event, "content-length"));
  // 20mb limit for now
  if (contentLength > 1024 * 1024 * 20) {
    // Payload too large
    throw createError({
      statusCode: 413,
      message: "Max size limit is 15mb",
    });
  }
  const {
    "sb-commit-timestamp": commitTimestampHeader,
    "sb-key": key,
    "sb-shasums": shasumsHeader,
    "sb-compact": compactHeader,
  } = getHeaders(event);
  const compact = compactHeader === "true";

  if (!key || !commitTimestampHeader || !shasumsHeader!) {
    throw createError({
      statusCode: 400,
      message:
        "sb-commit-timestamp, sb-key and sb-shasums headers are required",
    });
  }

  const shasums: Record<string, string> = JSON.parse(shasumsHeader);
  const formData = await readFormData(event);
  const packages = [...formData.keys()].filter((k) => k.startsWith("package:"));
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
  const workflowsBucket = useWorkflowsBucket(event);
  const cursorBucket = useCursorsBucket(event);

  if (!(await workflowsBucket.hasItem(key))) {
    throw createError({
      statusCode: 401,
      message:
        "Try publishing from a github workflow! Also make sure you install https://github.com/apps/pkg-pr-new Github app on the repo",
    });
  }

  const commitTimestamp = Number(commitTimestampHeader);

  const workflowData = (await workflowsBucket.getItem(key))!;

  const sha = abbreviateCommitHash(workflowData.sha);
  const baseKey = `${workflowData.owner}:${workflowData.repo}`;

  const cursorKey = `${baseKey}:${workflowData.ref}`;

  const currentCursor = await cursorBucket.getItem(cursorKey);

  await Promise.all(
    packages.map(async (packageNameWithPrefix) => {
      const packageName = packageNameWithPrefix.slice("package:".length);

      const file = formData.get(packageNameWithPrefix)! as File;
      const packageKey = `${baseKey}:${sha}:${packageName}`;

      const stream = file.stream();
      return setItemStream(event, usePackagesBucket.base, packageKey, stream, {
        sha1: shasums[packageName],
      });
    }),
  );

  const templatesMap = new Map<string, Record<string, string>>();

  await Promise.all(
    templateAssets.map(async (templateAssetWithPrefix) => {
      const [template, encodedTemplateAsset] = templateAssetWithPrefix
        .slice("template:".length)
        .split(":");
      const templateAsset = decodeURIComponent(encodedTemplateAsset);

      const file = formData.get(templateAssetWithPrefix)!;
      const isBinary = !(typeof file === 'string')
      const uuid = randomUUID();

      templatesMap.set(template, {
        ...templatesMap.get(template),
        [templateAsset]: isBinary ? new URL(`/template/${uuid}`, origin).href : file,
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

  if (!currentCursor || currentCursor.timestamp < commitTimestamp) {
    await cursorBucket.setItem(cursorKey, {
      sha,
      timestamp: commitTimestamp,
    });
  }

  await workflowsBucket.removeItem(key);

  const app = useOctokitApp(event);

  const { data: installationData } = await app.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    {
      owner: workflowData.owner,
      repo: workflowData.repo,
    },
  );

  const installation = await app.getInstallationOctokit(installationData.id);

  const checkName = "Continuous Releases";
  const {
    data: { check_runs },
  } = await installation.request(
    "GET /repos/{owner}/{repo}/commits/{ref}/check-runs",
    {
      check_name: checkName,
      owner: workflowData.owner,
      repo: workflowData.repo,
      ref: sha,
      app_id: Number(appId),
    },
  );

  if (!check_runs.length) {
    await installation.request("POST /repos/{owner}/{repo}/check-runs", {
      name: checkName,
      owner: workflowData.owner,
      repo: workflowData.repo,
      head_sha: sha,
      output: {
        title: "Successful",
        summary: "Published successfully.",
        text: generateCommitPublishMessage(
          origin,
          templatesHtmlMap,
          packages,
          workflowData,
          compact,
        ),
      },
      conclusion: "success",
    });
  }

  if (isPullRequest(workflowData.ref)) {
    const { data } = await installation.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: workflowData.owner,
        repo: workflowData.repo,
        issue_number: Number(workflowData.ref),
      },
    );
    const appComments = data.filter(
      (comment) => comment.performed_via_github_app?.id === Number(appId),
    );

    if (appComments.length) {
      const prevComment = appComments[0];
      await installation.request(
        "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        {
          owner: workflowData.owner,
          repo: workflowData.repo,
          comment_id: prevComment.id,
          body: generatePullRequestPublishMessage(
            origin,
            templatesHtmlMap,
            packages,
            workflowData,
            compact,
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
            packages,
            workflowData,
            compact,
          ),
        },
      );
    }
  }

  return {
    ok: true,
    urls: packages.map(
      (packageName) =>
        generatePublishUrl("sha", origin, packageName, workflowData, compact)
          .href,
    ),
  };
});
