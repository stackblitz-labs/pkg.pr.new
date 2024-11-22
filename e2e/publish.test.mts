import { exec } from "child_process";
import { platform } from "os";
import wp from "wait-port";
import assert from "node:assert";
import ezSpawn from "@jsdevtools/ez-spawn";
import pushWorkflowRunInProgressFixture from "./fixtures/workflow_run.in_progress.json" with { type: "json" };
import prWorkflowRunRequestedFixture from "./fixtures/pr.workflow_run.requested.json" with { type: "json" };
import prPullRequestSynchronizeFixture from "./fixtures/pr.pull_request.json" with { type: "json" };

const PORT = 8788; // wrangler default

const c = new AbortController();

const serverUrl = new URL(`http://localhost:${PORT}`);

await ezSpawn.async(
  `pnpm cross-env TEST=true API_URL=${serverUrl.href} pnpm -w run build`,
  [],
  {
    stdio: "inherit",
    shell: true,
  },
);

ezSpawn.async(
  "pnpm cross-env TEST=true pnpm --filter=backend run preview",
  [],
  {
    stdio: "inherit",
    shell: true,
    signal: c.signal,
    killSignal: "SIGINT",
  },
);

await wp({ port: PORT });

for (const [{ event, payload }, pr] of [
  [pushWorkflowRunInProgressFixture],
  [prWorkflowRunRequestedFixture, prPullRequestSynchronizeFixture],
] as const) {
  {
    // workflow_job.queued
    const webhookUrl = new URL("/webhook", serverUrl);
    if (pr) {
      const prWebhookData = await fetch(webhookUrl, {
        method: "POST",
        headers: [
          ["x-github-delivery", "d81876a0-e8c4-11ee-8fca-9d3a2baa9707"],
          ["x-github-event", "pull_request"],
        ],
        body: JSON.stringify(pr.payload),
      });
      assert.deepEqual(await prWebhookData.json(), { ok: true });
    }

    const webhookData = await fetch(webhookUrl, {
      method: "POST",
      headers: [
        ["x-github-delivery", "d81876a0-e8c4-11ee-8fca-9d3a2baa9707"],
        ["x-github-event", event],
      ],
      body: JSON.stringify(payload),
    });

    assert.deepEqual(await webhookData.json(), { ok: true });
  }

  {
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
    await ezSpawn.async(
      `pnpm cross-env ${env} pnpm run publish:playgrounds`,
      [],
      {
        stdio: "inherit",
        shell: true,
      },
    );
  }

  {
    const [owner, repo] = payload.repository.full_name.split("/");
    const ref = pr?.payload.number ?? payload.workflow_run.head_branch;
    // install
    const playgroundShaUrl = new URL(
      `/${owner}/${repo}/playground-a@${payload.workflow_run.head_sha.substring(0, 7)}`,
      serverUrl,
    );
    {
      const playgroundShaData = await fetch(playgroundShaUrl, {
        method: "GET",
      });

      const playgroundShaBlob = await playgroundShaData.blob();
      assert.ok(!!playgroundShaBlob.size, "playground size should not be zero");
      assert.equal(
        playgroundShaData.status,
        200,
        "playground response should be 200",
      );

      const playgroundWithoutShaUrl = new URL(
        `/${owner}/${repo}/playground-a@${ref}`,
        serverUrl,
      );
      const playgroundWithoutShaData = await fetch(playgroundWithoutShaUrl, {
        method: "GET",
      });
      const playgroundWithoutShaBlob = await playgroundWithoutShaData.blob();
      assert.deepEqual(
        await playgroundShaBlob.arrayBuffer(),
        await playgroundWithoutShaBlob.arrayBuffer(),
        "sha urls and non-sha urls should not give different results",
      );
    }
    {
      playgroundShaUrl.searchParams.set("id", Date.now().toString());
      const playgroundProcess = await ezSpawn.async(
        `pnpm cross-env CI=true npx -f playground-a@${playgroundShaUrl}`,
        {
          stdio: "overlapped",
          shell: true,
        },
      );
      assert.ok(
        playgroundProcess.stdout.includes(
          "playground-a installed successfully!",
        ),
        "installation failed",
      );
    }
    {
      const playgroundBShaUrl = new URL(
        `/${owner}/${repo}/playground-b@${payload.workflow_run.head_sha.substring(0, 7)}`,
        serverUrl,
      );
      playgroundBShaUrl.searchParams.set("id", Date.now().toString());
      const playgroundProcess = await ezSpawn.async(
        `pnpm cross-env CI=true npx -f playground-b@${playgroundBShaUrl}`,
        {
          stdio: "overlapped",
          shell: true,
        },
      );
      assert.ok(
        // should import playground-a as well
        playgroundProcess.stdout.includes(
          "playground-a installed successfully!",
        ),
        "installation failed",
      );
      assert.ok(
        playgroundProcess.stdout.includes(
          "playground-b installed successfully!",
        ),
        "installation failed",
      );
    }
  }
}

{
  // redirect with short urls that have the same package name as repo name
  const url = new URL(`/tinylibs/tinybench@a832a55`, serverUrl);
  const response = await fetch(url);
  assert.ok(response.redirected, "did not redirect");
  assert.equal(
    response.url,
    new URL("/tinylibs/tinybench/tinybench@a832a55", serverUrl).href,
    "not the correct redirect",
  );
}
{
  // redirect with compact mode
  const url = new URL(`/tinybench@a832a55`, serverUrl);
  const response = await fetch(url);
  assert.ok(response.redirected, "did not redirect");
  assert.equal(
    response.url,
    new URL("/tinylibs/tinybench/tinybench@a832a55", serverUrl).href,
    "not the correct redirect",
  );
}

{
  const expectedUrl = new URL(
    `/stackblitz/sdk/${encodeURIComponent("@stackblitz/sdk")}@a832a55`,
    serverUrl,
  );

  // test for scoped packages
  const redirectedUrlResponse = await fetch(
    new URL("/stackblitz/sdk/@stackblitz/sdk@a832a55", serverUrl),
  );
  assert.ok(redirectedUrlResponse.redirected, "did not redirect");
  assert.equal(
    redirectedUrlResponse.url,
    expectedUrl.href,
    "not the correct redirect",
  );

  // redirect with compact mode for scoped packages.
  const url = new URL(`/@stackblitz/sdk@a832a55`, serverUrl);
  const response = await fetch(url);
  assert.ok(response.redirected, "did not redirect");
  assert.equal(response.url, expectedUrl.href, "not the correct redirect");
}

killPort();

async function killPort() {
  const os = platform();
  try {
    // checks the operating system
    if (os === "win32") {
      exec(
        "powershell.exe -Command \"Get-Process -Name 'workerd' | Stop-Process -Force\"",
        (error, stdout, stderr) => {
          if (error) {
            console.error(
              `Error stopping process on Windows: ${error.message}`,
            );
            throw error;
          }
          if (stderr) {
            throw stderr;
          }
        },
      );
    } else {
      await ezSpawn.async("kill -9 $(pgrep -f workerd)", [], {
        stdio: "inherit",
        shell: true,
        signal: c.signal,
        killSignal: "SIGINT",
      });
    }
  } catch (e) {
    console.error(e);
    c.abort();
    process.exit(1);
  } finally {
    c.abort();
    process.exit(0);
  }
}
