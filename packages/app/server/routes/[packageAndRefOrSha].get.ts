import { extractOwnerAndRepo, extractRepository } from '@pkg-pr-new/utils'
import { getPackageManifest } from 'query-registry'
import { z } from 'zod'

const paramsSchema = z.object({
  packageAndRefOrSha: z.string(),
})

export default eventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, paramsSchema.parse)
  const [packageName, refOrSha] = params.packageAndRefOrSha.split('@')

  const manifest = await getPackageManifest(packageName)

  const repository = extractRepository(manifest)
  if (!repository) {
    throw createError({
      status: 404,
    })
  }

  const match = extractOwnerAndRepo(repository)
  if (!match) {
    throw createError({
      status: 404,
    })
  }
  const [owner, repo] = match

  sendRedirect(event, `/${owner}/${repo}/${packageName}@${refOrSha}`)
})
