import { z } from 'zod'

const querySchema = z.object({
  owner: z.string(),
  repo: z.string(),
})

const getRepoInfo = defineCachedFunction(async (owner: string, repo: string) => {
  const { repository } = await useGithubGraphQL().graphql<{
    repository: {
      id: string
      name: string
      owner: {
        id: string
        avatarUrl: string
        login: string
      }
      url: string
      homepageUrl: string
      description: string
    }
  }>(`
query ($repoOwner: String!, $repoName: String!) {
  repository (owner: $repoOwner, name: $repoName) {
    id
    name
    owner {
      id
      avatarUrl
      login
    }
    url
    homepageUrl
    description
  }
}
`, {
    repoOwner: owner,
    repoName: repo,
  })

  return repository
}, {
  getKey: (owner: string, repo: string) => `${owner}/${repo}`,
  maxAge: 60 * 30, // 5 minutes
  swr: true,
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, data => querySchema.parse(data))
  return getRepoInfo(query.owner, query.repo)
})
