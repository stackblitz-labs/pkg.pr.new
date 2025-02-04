import { z } from 'zod'

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
  cursor: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, data => querySchema.parse(data))

  const { repository } = await useGithubGraphQL().graphql<{
    repository: {
      id: string
      defaultBranchRef: {
        id: string
        name: string
        target: {
          id: string
          history: {
            nodes: {
              id: string
              oid: string
              abbreviatedOid: string
              message: string
              authoredDate: string
              url: string
              statusCheckRollup: {
                id: string
                state: string
                contexts: {
                  nodes: {
                    id: string
                    status: string
                    name: string
                    title: string
                    summary: string
                    text: string
                    detailsUrl: string
                    url: string
                  }[]
                }
              }
            }[]
            pageInfo: {
              hasNextPage: boolean
              endCursor: string
            }
          }
        }
      }
    }
  }>(`
query ($repoOwner: String!, $repoName: String!, $cursor: String) {
  repository (owner: $repoOwner, name: $repoName) {
    id
    defaultBranchRef {
      id
      name
      target {
        id
        ...on Commit {
          history (first: 10, after: $cursor) {
            nodes {
              id
              oid
              abbreviatedOid
              message
              authoredDate
              url
              statusCheckRollup {
                id
                state
                contexts (first: 42) {
                  nodes {
                    ...on CheckRun {
                      id
                      status
                      name
                      title
                      summary
                      text
                      detailsUrl
                      url
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      }
    }
  }
}
`, {
    repoOwner: query.owner,
    repoName: query.repo,
    cursor: query.cursor,
  })

  return repository.defaultBranchRef
})
