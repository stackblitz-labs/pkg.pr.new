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
    "sb-compact": compactHeader,
  } = getHeaders(event);
  const compact = compactHeader === "true";

  if (!key || !commitTimestampHeader) {
    throw createError({
      statusCode: 400,
      message: "sb-commit-timestamp and sb-key headers are required",
    });
  }
  const workflowsBucket = useWorkflowsBucket(event);
  const packagesBucket = usePackagesBucket(event);
  const cursorBucket = useCursorsBucket(event);
  const checkRunBucket = useCheckRunsBucket(event);
  const pullRequestCommentsBucket = usePullRequestCommentsBucket(event);

  if (!(await workflowsBucket.hasItem(key))) {
    throw createError({
      statusCode: 401,
      message:
        "Try publishing from a github workflow or install https://github.com/apps/pkg-pr-new Github app on this repo",
    });
  }

  const commitTimestamp = Number(commitTimestampHeader);

  const workflowData = (await workflowsBucket.getItem(key))!;

  const sha = abbreviateCommitHash(workflowData.sha);
  const baseKey = `${workflowData.owner}:${workflowData.repo}`;
  const cursorKey = `${baseKey}:${workflowData.ref}`;

  const currentCursor = await cursorBucket.getItem(cursorKey);

  const formData = await readFormData(event);

  const packages = [...formData.keys()];
  for (const packageName of packages) {
    const file = formData.get(packageName)! as File;
    const packageKey = `${baseKey}:${sha}:${packageName}`;

    await packagesBucket.setItemRaw(packageKey, await file.arrayBuffer());
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

  const checkRunKey = `${baseKey}:${sha}`;

  if (!(await checkRunBucket.hasItem(checkRunKey))) {
    const checkRun = await installation.request(
      "POST /repos/{owner}/{repo}/check-runs",
      {
        name: "Continuous Releases",
        owner: workflowData.owner,
        repo: workflowData.repo,
        head_sha: sha,
        output: {
          title: "Successful",
          summary: "Published successfully.",
          text: generateCommitPublishMessage(
            origin,
            packages,
            workflowData,
            compact,
          ),
        },
        conclusion: "success",
      },
    );
    await checkRunBucket.setItem(checkRunKey, checkRun.data.id);
  }

  if (workflowData.isPullRequest) {
    const postComment = async () => {
      const comment = await installation.request(
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
      await pullRequestCommentsBucket.setItem(baseKey, comment.data.id);
    };

    const alreadyCommented = await pullRequestCommentsBucket.hasItem(baseKey);
    if (!alreadyCommented) {
      await postComment();
    } else {
      const prevCommentId = (await pullRequestCommentsBucket.getItem(baseKey))!;
      let exists = false;
      try {
        await installation.request(
          "GET /repos/{owner}/{repo}/issues/comments/{comment_id}",
          {
            owner: workflowData.owner,
            repo: workflowData.repo,
            comment_id: prevCommentId,
          },
        );
        exists = true;
      } catch {}
      if (exists) {
        await installation.request(
          "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
          {
            owner: workflowData.owner,
            repo: workflowData.repo,
            comment_id: prevCommentId,
            body: generatePullRequestPublishMessage(
              origin,
              packages,
              workflowData,
              compact,
            ),
          },
        );
      } else {
        // deleted comment
        await postComment();
      }
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
