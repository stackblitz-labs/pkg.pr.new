export default eventHandler(async (event) => {
  const data = await readRawBody(event);
  const workflowsBucket = useWorkflowsBucket(event);

  const { owner, repo, key } = JSON.parse(data!);

  const app = useOctokitApp(event);

  try {
    await app.octokit.request("GET /repos/{owner}/{repo}/installation", {
      owner,
      repo,
    });
  } catch {
    throw createError({
      statusCode: 404,
      fatal: true,
      message: `The app https://github.com/apps/pkg-pr-new is not installed on ${owner}/${repo}.`,
    });
  }
  const workflowData = await workflowsBucket.getItem(key);

  if (!workflowData) {
    throw createError({
      statusCode: 404,
      fatal: true,
      message: `There is no workflow defined for ${key}`,
    });
  }

  const {status} = await app.octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
    owner,
    repo,
    ref: workflowData.sha,
  });
  console.log('status', status)

  // if (status === 404)

  return { sha: workflowData.sha };
});
