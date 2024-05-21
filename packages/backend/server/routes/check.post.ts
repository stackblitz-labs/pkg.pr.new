export default eventHandler(async (event) => {
  const data = await readRawBody(event);
  const { owner, repo } = JSON.parse(data!);

  const app = useOctokitApp(event);

  try {
    await app.octokit.request("GET /repos/{owner}/{repo}/installation", {
      owner: owner,
      repo: repo,
    });
  } catch {
    throw createError({
      statusCode: 404,
      message: `The app https://github.com/apps/pkg-pr-new is not installed on ${owner}/${repo}.`,
    });
  }
});
