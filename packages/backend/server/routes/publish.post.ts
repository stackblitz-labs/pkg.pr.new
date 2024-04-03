import { objectHash, sha256 } from "ohash";

export default eventHandler(async (event) => {
  const contentLength = Number(getHeader(event, "content-length"));
  // 5mb limits for now
  if (contentLength > 1024 * 1024 * 5) {
    // Payload too large
    return new Response("Max size limit is 5mb", { status: 413 });
  }
  const {
    "sb-package-name": packageName,
    "sb-commit-timestamp": commitTimestampStr,
    "sb-key": key,
  } = getHeaders(event);
  if (
    !key ||
    !packageName ||
    !commitTimestampStr
  ) {
    throw createError({
      statusCode: 400,
      message:
        "sb-package-name, sb-commit-timestamp, sb-key headers are required",
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
        "Try publishing from a github workflow or install Stackblitz CR Github app on this repo",
    });
  }

  const binary = await readRawBody(event, false);

  const commitTimestamp = Number(commitTimestampStr);

  const workflowData = (await workflowsBucket.getItem(key))!;
  const { sha, isPullRequest, ...hashPrefixMetadata } = workflowData;
  const metadataHash = sha256(objectHash(hashPrefixMetadata));
  const packageKey = `${metadataHash}:${sha}:${packageName}`;

  const currentCursor = await cursorBucket.getItem(metadataHash);

  await packagesBucket.setItemRaw(packageKey, binary);
  if (!currentCursor || currentCursor.timestamp < commitTimestamp) {
    await cursorBucket.setItem(metadataHash, {
      sha,
      timestamp: commitTimestamp,
    });
  }

  await workflowsBucket.removeItem(key);

  console.log('event', event)
  const app = useOctokitApp(event);
  console.log('app', app)
  const origin = getRequestURL(event).origin;

  const { data: installationData } = await app.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    {
      owner: workflowData.owner,
      repo: workflowData.repo,
    }
  );

  const installation = await app.getInstallationOctokit(installationData.id);

  const checkRunKey = `${metadataHash}:${sha}`;

  if (!(await checkRunBucket.hasItem(checkRunKey))) {
    const checkRun = await installation.request(
      "POST /repos/{owner}/{repo}/check-runs",
      {
        name: "Stackblitz CR",
        owner: workflowData.owner,
        repo: workflowData.repo,
        head_sha: sha,
        output: {
          title: "Successful",
          summary: "Published successfully.",
          text: generateCommitPublishMessage(origin, packageName, workflowData),
        },
        conclusion: "success",
      }
    );
    await checkRunBucket.setItem(checkRunKey, checkRun.data.id);
  }
  if (isPullRequest) {
    const alreadyCommented = await pullRequestCommentsBucket.hasItem(
      metadataHash
    );
    if (!alreadyCommented) {
      const comment = await installation.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner: workflowData.owner,
          repo: workflowData.repo,
          issue_number: Number(workflowData.ref.slice("pr-".length)),
          body: generatePullRequestPublishMessage(
            origin,
            packageName,
            workflowData
          ),
        }
      );
      await pullRequestCommentsBucket.setItem(metadataHash, comment.data.id);
    } else {
      const prevCommentId = (await pullRequestCommentsBucket.getItem(
        metadataHash
      ))!;
      await installation.request(
        "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        {
          owner: workflowData.owner,
          repo: workflowData.repo,
          comment_id: prevCommentId,
          body: generatePullRequestPublishMessage(
            origin,
            packageName,
            workflowData
          ),
        }
      );
    }
  }

  return { ok: true };
});
