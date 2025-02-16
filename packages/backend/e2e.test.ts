import type { Response } from '@cloudflare/workers-types'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { unstable_dev, UnstableDevWorker } from 'wrangler'
import ezSpawn from "@jsdevtools/ez-spawn"
import pushWorkflowRunInProgressFixture from './fixtures/workflow_run.in_progress.json'
import prWorkflowRunRequestedFixture from './fixtures/pr.workflow_run.requested.json'
import prPullRequestSynchronizeFixture from './fixtures/pr.pull_request.json'
import { simulation } from '@simulacrum/github-api-simulator'

let server;
let workerUrl: string;

let worker: UnstableDevWorker
beforeAll(async () => {
  const app = simulation({
    initialState: {
      users: [],
      organizations: [{ login: "stackblitz-labs" }],
      repositories: [{ owner: "stackblitz-labs", name: "temporary-test" }],
      branches: [{ name: "main" }],
      blobs: [],
    },
  });
  server = await app.listen(3300);

  await ezSpawn.async('pnpm cross-env TEST=true pnpm --filter=backend run build', [], {
    stdio: "inherit",
    shell: true,
  });
  worker = await unstable_dev(`${import.meta.dirname}/dist/_worker.js`, {
    config: `${import.meta.dirname}/wrangler.toml`,
  })
  const url = `${worker.proxyData.userWorkerUrl.protocol}//${worker.proxyData.userWorkerUrl.hostname}:${worker.proxyData.userWorkerUrl.port}` 
  console.log(url)
  workerUrl = url
  await ezSpawn.async(`pnpm cross-env TEST=true API_URL=${url} pnpm --filter=pkg-pr-new run build`, [], {
    stdio: "inherit",
    shell: true,
  });
})

afterAll(async () => {
  await server.ensureClose();
});

describe.sequential.each([
  [pushWorkflowRunInProgressFixture],
  [prWorkflowRunRequestedFixture, prPullRequestSynchronizeFixture]
] as const)('webhook endpoints', (...fixture) => {
  const [{event, payload}, pr] = fixture
  const mode = pr ? 'pr' : 'commit' 
  it(`handles ${mode} events`, async () => {
    // Send PR event if exists
    if (pr) {
      const prResponse = await worker.fetch('/webhook', {
        method: 'POST',
        headers: {
          'x-github-delivery': 'd81876a0-e8c4-11ee-8fca-9d3a2baa9707',
          'x-github-event': 'pull_request',
        },
        body: JSON.stringify(pr.payload),
      })
      expect(await prResponse.json()).toEqual({ ok: true })
    }

    // Send workflow run event
    const response = await worker.fetch('/webhook', {
      method: 'POST',
      headers: {
        'x-github-delivery': 'd81876a0-e8c4-11ee-8fca-9d3a2baa9707',
        'x-github-event': event,
      },
      body: JSON.stringify(payload),
    })
    expect(await response.json()).toEqual({ ok: true })
  })

  it(`publishes playgrounds for ${mode}`, async () => {
    const env = Object.entries({
      TEST: true,
      GITHUB_SERVER_URL: new URL(payload.workflow_run.html_url).origin,
      GITHUB_REPOSITORY: payload.repository.full_name,
      GITHUB_RUN_ID: payload.workflow_run.id,
      GITHUB_RUN_ATTEMPT: payload.workflow_run.run_attempt,
      GITHUB_ACTOR_ID: payload.sender.id,
      GITHUB_SHA: payload.workflow_run.head_sha,
      GITHUB_ACTION: payload.workflow_run.id,
      GITHUB_JOB: payload.workflow_run.name,
      GITHUB_REF_NAME: pr
        ? `${pr.payload.number}/merge`
        : payload.workflow_run.head_branch,
    })
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(" ");

      try {
    const process = await ezSpawn.async(`pnpm cross-env ${env} pnpm run -w publish:playgrounds`, [], {
      stdio: "overlapped",
      shell: true,
    });
    console.log(process.stdout)

      } catch (e) {
        console.log(e)

      }
      
  })

  it(`serves and installs playground-a for ${mode}`, async () => {
    const [owner, repo] = payload.repository.full_name.split('/')
    const sha = payload.workflow_run.head_sha.substring(0, 7)
    const ref = pr?.payload.number ?? payload.workflow_run.head_branch

    // Test download with SHA
    const shaResponse = await worker.fetch(`/${owner}/${repo}/playground-a@${sha}`)
    expect(shaResponse.status).toBe(200)
    const shaBlob = await shaResponse.blob()
    expect(shaBlob.size).toBeGreaterThan(0)

    // Test download with ref matches SHA content
    const refResponse = await fetchWithRedirect(`/${owner}/${repo}/playground-a@${ref}`)
    const refBlob = await refResponse.blob()
    const shaBlobSize = await shaBlob.arrayBuffer();
    const refBlobSize = await refBlob.arrayBuffer();
    expect(shaBlobSize.byteLength).toEqual(refBlobSize.byteLength);
    expect(shaBlobSize).toEqual(refBlobSize);

    // Test installation
    const url = new URL(`/${owner}/${repo}/playground-a@${sha}?id=${Date.now()}`,workerUrl)
    const installProcess = await ezSpawn.async(`pnpm cross-env CI=true npx -f playground-a@${url}`, {
      stdio: "overlapped",
      shell: true,
    });
    expect(installProcess.stdout).toContain('playground-a installed successfully!')
  })

  it(`serves and installs playground-b for ${mode}`, async () => {
    const [owner, repo] = payload.repository.full_name.split('/')
    const sha = payload.workflow_run.head_sha.substring(0, 7)

    // Test download
    const response = await worker.fetch(`/${owner}/${repo}/playground-b@${sha}`)
    expect(response.status).toBe(200)

    // Test installation
    const url = new URL(`/${owner}/${repo}/playground-b@${sha}?id=${Date.now()}`,workerUrl)
    const installProcess = await ezSpawn.async(`pnpm cross-env CI=true npx -f playground-b@${url}`, {
      stdio: "overlapped",
      shell: true,
    });
    expect(installProcess.stdout).toContain('playground-a installed successfully!') // Should import playground-a
    expect(installProcess.stdout).toContain('playground-b installed successfully!')
  })
})

describe('URL redirects', () => {
  describe('standard packages', () => {
    it('redirects full URLs correctly', async () => {
      const response = await fetchWithRedirect('/tinylibs/tinybench@a832a55')
      expect(response.url).toContain('/tinylibs/tinybench/tinybench@a832a55')
    })

    it('redirects compact URLs correctly', async () => {
      const response = await fetchWithRedirect('/tinybench@a832a55')
      expect(response.url).toContain('/tinylibs/tinybench/tinybench@a832a55')
    })
  })

  describe('scoped packages', () => {
    const expectedPath = `/stackblitz/sdk/${encodeURIComponent('@stackblitz/sdk')}@a832a55`

    it('redirects full scoped package URLs correctly', async () => {
      const response = await fetchWithRedirect('/stackblitz/sdk/@stackblitz/sdk@a832a55')
      expect(response.url).toContain(expectedPath)
    })

    it('redirects compact scoped package URLs correctly', async () => {
      const response = await fetchWithRedirect('/@stackblitz/sdk@a832a55')
      expect(response.url).toContain(expectedPath)
    })
  })
})

async function fetchWithRedirect(url: string, maxRedirects = 999): Promise<Response> {
  const response = await worker.fetch(url, { redirect: 'manual' })
  
  if (response.status >= 300 && response.status < 400 && maxRedirects > 0) {
    const location = response.headers.get('location')
    if (location) {
      return fetchWithRedirect(location, maxRedirects - 1)
    }
  }
  
  return response
}