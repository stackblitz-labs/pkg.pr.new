import wp from "wait-port";
import assert from "node:assert";
import ezSpawn from "@jsdevtools/ez-spawn";
import { objectHash, sha256 } from "ohash";
import kill from 'kill-port'
import workflowJobQueuedFixture from './fixtures/workflow_job.queued.json' with {type: 'json'}

const PORT = 8788; // wrangler default

const c = new AbortController();

const serverUrl = new URL(`http://localhost:${PORT}`)

ezSpawn.sync(`TEST=true API_URL=${serverUrl.href} pnpm -w run build`, [], {
  stdio: 'inherit',
  shell: true,
})

ezSpawn.async("pnpm --filter=backend run preview", [], {
  stdio: 'inherit',
  shell: true,
  signal: c.signal,
  killSignal: "SIGSTOP",
});

await wp({ port: PORT });

{
  // workflow_job.queued
  const webhookUrl = new URL('/webhook', serverUrl)

  const webhookData = await fetch(webhookUrl, {
    method: 'POST',
    headers: [
     ["x-github-delivery", 'd81876a0-e8c4-11ee-8fca-9d3a2baa9707'],
     ["x-github-event", "workflow_job"],
    ],
    body: JSON.stringify(workflowJobQueuedFixture.payload)
  })
  assert.deepEqual(await webhookData.json(), { ok: true})
}

{
  const metadata = {
    url: workflowJobQueuedFixture.payload.workflow_job.url,
    attempt: workflowJobQueuedFixture.payload.workflow_job.run_attempt,
    actor: workflowJobQueuedFixture.payload.sender.id,
  };
  const key = sha256(objectHash(metadata))
  // publish
  const publishUrl = new URL('/publish', serverUrl)
  fetch(publishUrl, {
    method: 'POST',
    headers: [
     ["sb-key", key],
    ],
    body: new Uint8Array(new Array(100).fill(1)),
  })
}

{
  const env = Object.entries({
    TEST: true,
    GITHUB_SERVER_URL: new URL(workflowJobQueuedFixture.payload.workflow_job.html_url).origin,
    GITHUB_REPOSITORY: workflowJobQueuedFixture.payload.repository.full_name,
    GITHUB_RUN_ID: workflowJobQueuedFixture.payload.workflow_job.run_id,
    GITHUB_RUN_ATTEMPT: workflowJobQueuedFixture.payload.workflow_job.run_attempt,
    GITHUB_ACTOR_ID:workflowJobQueuedFixture.payload.sender.id ,
  }).map(([k, v]) => `${k}=${v}`).join(' ') 
  await ezSpawn.async(`${env} pnpm --filter=playground run publish`, [], {
    stdio: 'inherit',
    shell: true,
  });
}

{
  // install
    const playgroundUrl = new URL('/stackblitz-labs/stackblitz-ci/main/41cc8072abe146bb7eddc4b39de644a77acd1e9d/playground', serverUrl)
  {
    const data = await fetch(playgroundUrl, {
      method: 'GET',
    })
  
    const blob =await data.blob() 
    console.log(blob)
    assert.ok(!!blob.size, "playground size should not be zero")
    assert.equal(data.status, 200, "playground response should be 200")
  }
  {
    playgroundUrl.searchParams.set('id', Date.now().toString())
    const playgroundProcess = await ezSpawn.async(`yes | npx -f playground@${playgroundUrl}`,{
      stdio: 'overlapped',
      shell: true,
    })
    assert.ok(playgroundProcess.stdout.includes("playground installed successfully!"), "installation failed")
  }
  
}





// // c.abort();
// // await p

// process.on('beforeExit', () => {
//   c.abort()
// })
