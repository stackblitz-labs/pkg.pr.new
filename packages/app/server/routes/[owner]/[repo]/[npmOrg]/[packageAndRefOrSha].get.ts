import { z } from 'zod'

const paramsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  npmOrg: z.string(),
  packageAndRefOrSha: z.string(),
})

export default eventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, paramsSchema.parse)
  const [noScopePackageName, refOrSha] = params.packageAndRefOrSha.split('@')
  const packageName = `${params.npmOrg}/${noScopePackageName}`

  sendRedirect(
    event,
    `/${params.owner}/${params.repo}/${encodeURIComponent(packageName)}@${refOrSha}`,
  )
})
