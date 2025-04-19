import type { H3Event } from 'h3'
import { z } from 'zod'
import { useGithubREST } from '../../../server/utils/octokit'

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
})

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    })
  ])
}

const getRepoInfo = defineCachedFunction(async (owner: string, repo: string, event?: H3Event) => {
  try {
    const octokit = useGithubREST(event)

    const { data } = await withTimeout(
      octokit.request('GET /repos/{owner}/{repo}', {
        owner,
        repo,
      }),
      10000,
      'GitHub API repository request timed out'
    )

    return {
      id: data.id.toString(),
      name: data.name,
      owner: {
        id: data.owner.id.toString(),
        avatarUrl: data.owner.avatar_url,
        login: data.owner.login,
      },
      url: data.html_url,
      homepageUrl: data.homepage || '',
      description: data.description || '',
    }
  } catch (error) {
    console.error(`Error fetching repository info for ${owner}/${repo}:`, error)
    throw error
  }
}, {
  getKey: (owner: string, repo: string, _event?: H3Event) => `${owner}/${repo}`,
  maxAge: 60 * 30, // 30 minutes
  swr: true,
})

export default defineEventHandler(async (event) => {
  try {
    const query = await getValidatedQuery(event, data => querySchema.parse(data))
    return getRepoInfo(query.owner, query.repo, event)
  } catch (error) {
    console.error('Error in repo info endpoint:', error)
    return {
      error: true,
      message: (error as Error).message,
      id: 'error',
      name: 'error',
      owner: {
        id: 'error',
        avatarUrl: '',
        login: 'error'
      },
      url: '',
      homepageUrl: '',
      description: 'Error fetching repository data'
    }
  }
})
