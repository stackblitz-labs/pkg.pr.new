import process from 'node:process'
import { graphql } from '@octokit/graphql'

let graphQlWithAuth: typeof graphql

export function useGithubGraphQL() {
  if (!graphQlWithAuth) {
    graphQlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${process.env.NUXT_GITHUB_TOKEN}`,
      },
    })
  }
  return {
    graphql: graphQlWithAuth,
  }
}
