import { z } from 'zod'
import { useGithubREST } from '../../../server/utils/octokit'

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
  cursor: z.string().optional(),
  page: z.string().optional(),
  per_page: z.string().optional().default('10'),
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
    const octokit = useGithubREST(event)

    const { data: repo } = await withTimeout(
      octokit.request('GET /repos/{owner}/{repo}', {
        owner: query.owner,
        repo: query.repo,
      }),
      10000,
      'GitHub API repository request timed out'
    )

    const defaultBranch = repo.default_branch

    const page = query.page ? parseInt(query.page) : query.cursor ? parseInt(query.cursor) : 1
    const per_page = parseInt(query.per_page)

    const { data: commits } = await withTimeout(
      octokit.request('GET /repos/{owner}/{repo}/commits', {
        owner: query.owner,
        repo: query.repo,
        sha: defaultBranch,
        page,
        per_page,
      }),
      10000,
      'GitHub API commits request timed out'
    )

    const commitsWithStatuses = await Promise.all(
      commits.map(async (commit) => {
        try {
          const { data: checkRuns } = await withTimeout(
            octokit.request('GET /repos/{owner}/{repo}/commits/{ref}/check-runs', {
              owner: query.owner,
              repo: query.repo,
              ref: commit.sha,
            }),
            5000,
            `Check runs request timed out for commit ${commit.sha}`
          )

          return {
            id: commit.node_id || commit.sha,
            oid: commit.sha,
            abbreviatedOid: commit.sha.substring(0, 7),
            message: commit.commit.message,
            authoredDate: commit.commit.author?.date || '',
            url: commit.html_url,
            statusCheckRollup: checkRuns.check_runs.length > 0 ? {
              id: `status-${commit.sha}`,
              state: checkRuns.check_runs.some(check => check.conclusion === 'failure') ? 'FAILURE' :
                checkRuns.check_runs.some(check => check.conclusion === 'success') ? 'SUCCESS' : 'PENDING',
              contexts: {
                nodes: checkRuns.check_runs.map(check => ({
                  id: check.id.toString(),
                  status: check.status,
                  name: check.name,
                  title: check.name,
                  summary: check.output?.summary || '',
                  text: check.output?.text || '',
                  detailsUrl: check.details_url || '',
                  url: check.url || check.html_url || '',
                }))
              }
            } : null
          }
        } catch (error) {
          console.warn(`Could not fetch check runs for commit ${commit.sha}:`, error)
          return {
            id: commit.node_id || commit.sha,
            oid: commit.sha,
            abbreviatedOid: commit.sha.substring(0, 7),
            message: commit.commit.message,
            authoredDate: commit.commit.author?.date || '',
            url: commit.html_url,
            statusCheckRollup: null
          }
        }
      })
    )

    // Check if there are more commits (GitHub API doesn't provide this directly)
    // We'll need to check if we got a full page of results
    const hasNextPage = commits.length === per_page
    const nextPage = hasNextPage ? (page + 1).toString() : null

    return {
      id: `branch-${defaultBranch}`,
      name: defaultBranch,
      target: {
        id: `target-${defaultBranch}`,
        history: {
          nodes: commitsWithStatuses,
          pageInfo: {
            hasNextPage,
            endCursor: nextPage
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching repository commits:', error)

    return {
      id: 'error',
      name: 'error',
      error: true,
      message: (error as Error).message,
      target: {
        id: 'error-target',
        history: {
          nodes: [],
          pageInfo: {
            hasNextPage: false,
            endCursor: null
          }
        }
      }
    }
  }
})
