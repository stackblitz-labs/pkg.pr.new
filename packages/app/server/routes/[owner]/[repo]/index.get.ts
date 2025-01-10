import { extractOwnerAndRepo, extractRepository } from '@pkg-pr-new/utils'
import { getPackageManifest } from 'query-registry'
import { z } from 'zod'

const paramsSchema = z.object({
  owner: z.string(),
  repo: z.string(),
})

// https://pkg.pr.new/tinylibs/tinybench@a832a55
export default eventHandler(async (event) => {
  const params = await getValidatedRouterParams(event, paramsSchema.parse)
  const [packageName, refOrSha] = params.repo.split('@')

  // /@stackblitz/sdk@a832a55
  if (params.owner.startsWith('@')) {
    // it's not a short url, it's a scoped package in compact mode
    const npmOrg = params.owner
    const packageNameWithOrg = `${npmOrg}/${packageName}`
    const manifest = await getPackageManifest(packageNameWithOrg)

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

    sendRedirect(
      event,
      `/${owner}/${repo}/${encodeURIComponent(packageNameWithOrg)}@${refOrSha}`,
    )
    return
  }

  // -> https://pkg.pr.new/tinylibs/tinybench/tinybench@a832a55
  sendRedirect(
    event,
    `/${params.owner}/${packageName}/${packageName}@${refOrSha}`,
  )
})
