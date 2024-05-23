import { abbreviateCommitHash, isPullRequest } from "@pkg-pr-new/utils";

export default eventHandler(async (event) => {
  const contentLength = Number(getHeader(event, "content-length"));
  // 5mb limits for now
  if (contentLength > 1024 * 1024 * 5) {
    // Payload too large
    return new Response("Max size limit is 5mb", { status: 413 });
  }
  const {
    "sb-commit-timestamp": commitTimestampHeader,
    "sb-key": key,
    "sb-shasums": shasumsHeader,
    "sb-compact": compactHeader,
  } = getHeaders(event);
  const compact = compactHeader === "true";

  if (!key || !commitTimestampHeader || !shasumsHeader) {
    throw createError({
      statusCode: 400,
      message:
        "sb-commit-timestamp, sb-key and sb-shasums headers are required",
    });
  }

  const shasums: Record<string, string> = JSON.parse(shasumsHeader);
  const formData = await readFormData(event);
  const packages = [...formData.keys()];

  if (!packages.length) {
    throw createError({
      statusCode: 400,
      message:
        "No packages",
    });
  }

  const { appId } = useRuntimeConfig(event);
  const workflowsBucket = useWorkflowsBucket(event);
  const packagesBucket = usePackagesBucket(event);
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
  
  for (const packageName of packages) {
    const file = formData.get(packageName)! as File;
    const packageKey = `${baseKey}:${sha}:${packageName}`;

    await packagesBucket.setItemRaw(packageKey, await file.arrayBuffer(), {
      sha1: shasums[packageName],
    } as R2PutOptions);
  }

  if (!currentCursor || currentCursor.timestamp < commitTimestamp) {
    await cursorBucket.setItem(cursorKey, {
      sha,
      timestamp: commitTimestamp,
    });
  }

  await workflowsBucket.removeItem(key);

  const app = useOctokitApp(event);
  const origin = getRequestURL(event).origin;

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
        text: generateCommitPublishMessage(origin, packages, workflowData, compact),
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
