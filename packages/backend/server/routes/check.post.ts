export default eventHandler(async (event) => {
  const data = await readRawBody(event);
  const { owner, repo } = JSON.parse(data!);

  const app = useOctokitApp(event);

  const { status } = await app.octokit.request(
    "GET /repos/{owner}/{repo}/installation",
    {
      owner: owner,
      repo: repo,
    },
  );

  console.log(owner, repo, status);
  if (status !== 200) {
    throw createError({
      statusCode: 404,
      message: `The app https://github.com/apps/pkg-pr-new is not installed on ${owner}/${repo}.`,
    });
  }
});
