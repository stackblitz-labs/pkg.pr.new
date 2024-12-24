export default eventHandler(async (event) => {
  const data = await readRawBody(event)
  const workflowsBucket = useWorkflowsBucket(event)

  const { owner, repo, key } = JSON.parse(data!)

  const app = useOctokitApp(event)

  let authenticated = false

  try {
    await app.octokit.request('GET /repos/{owner}/{repo}/installation', {
      owner,
      repo,
    })
    authenticated = true
  }
  catch {}

  try {
    await app.octokit.request('GET /orgs/{org}/installation', {
      org: owner,
    })
    authenticated = true
  }
  catch {}

  if (!authenticated) {
    throw createError({
      statusCode: 404,
      fatal: true,
      message: `The app https://github.com/apps/pkg-pr-new is not installed on ${owner}/${repo}.`,
    })
  }

  const workflowData = await workflowsBucket.getItem(key)

  if (!workflowData) {
    throw createError({
      statusCode: 404,
      fatal: true,
      message: `There is no workflow defined for ${key}`,
    })
  }
  return { sha: workflowData.sha }
})
