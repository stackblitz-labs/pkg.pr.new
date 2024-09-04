import { z } from 'zod'

const querySchema = z.object({
  text: z.string(),
})

export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, data => querySchema.parse(data))

  if (!query.text) {
    return null
  }

  const result = await useGithubGraphQL().graphql<{
    search: {
      nodes: {
        id: string
        name: string
        owner: {
          id: string
          login: string
          avatarUrl: string
        }
      }[]
    }
  }>(`
    query ($text: String!) {
      search (type: REPOSITORY, query: $text, first: 10) {
        nodes {
          ...on Repository {
            id
            name
            owner {
              id
              login
              avatarUrl
            }
          }
        }
      }
    }
  `, {
    text: query.text,
  })

  return result.search
})
