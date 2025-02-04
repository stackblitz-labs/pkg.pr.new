import type { H3Event } from 'h3'
import process from 'node:process'
import { App } from '@octokit/app'
import { graphql } from '@octokit/graphql'
import { paginateRest } from '@octokit/plugin-paginate-rest'
import { Octokit } from 'octokit'

let graphQlWithAuth: typeof graphql

export function useGithubGraphQL() {
  if (!graphQlWithAuth) {
    const { githubToken } = useRuntimeConfig()
    graphQlWithAuth = graphql.defaults({
      headers: {
        authorization: `token ${githubToken}`,
      },
    })
  }
  return {
    graphql: graphQlWithAuth,
  }
}

export function useOctokitApp(event: H3Event) {
  const { appId, privateKey, webhookSecret } = useRuntimeConfig(event)

  const MyOctokit = Octokit.plugin(paginateRest)

  return new App({
    appId,
    privateKey,
    webhooks: { secret: webhookSecret },
    Octokit: MyOctokit,
  })
}

export async function useOctokitInstallation(event: H3Event, owner: string, repo: string) {
  const app = useOctokitApp(event)
  const { data: installationData } = await app.octokit.request(
    'GET /repos/{owner}/{repo}/installation',
    {
      owner,
      repo,
    },
  )

  return app.getInstallationOctokit(installationData.id)
}
