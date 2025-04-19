import { z } from 'zod'
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import { useGithubREST } from '../../../server/utils/octokit'

const querySchema = z.object({
  text: z.string(),
})

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    })
  ])
}

export default defineEventHandler(async (event) => {
  try {
    const query = await getValidatedQuery(event, data => querySchema.parse(data))

    if (!query.text) {
      return { nodes: [] }
    }

    const octokit = useGithubREST(event)

    const { data } = await withTimeout(
      octokit.request('GET /search/repositories', {
        q: query.text,
        per_page: 10
      }),
      10000,
      'GitHub API search request timed out'
    )

    return {
      nodes: data.items.map((repo: RestEndpointMethodTypes['search']['repos']['response']['data']['items'][0]) => ({
        id: repo.id.toString(),
        name: repo.name,
        owner: repo.owner ? {
          id: repo.owner.id.toString(),
          login: repo.owner.login,
          avatarUrl: repo.owner.avatar_url
        } : null
      }))
    }
  } catch (error) {
    console.error('Error in repository search:', error);
    return {
      nodes: [],
      error: true,
      message: (error as Error).message
    }
  }
})
