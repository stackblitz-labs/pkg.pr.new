import { exec } from "child_process";
import { platform } from "os";
import wp from "wait-port";
import assert from "node:assert";
import ezSpawn from "@jsdevtools/ez-spawn";
import pushWorkflowJobQueuedFixture from "./fixtures/workflow_job.queued.json" with { type: "json" };
import prWorkflowJobQueuedFixture from "./fixtures/pr.workflow_job.queued.json" with { type: "json" };
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

ezSpawn.async("pnpm --filter=backend run preview", [], {
  stdio: "inherit",
  shell: true,
  signal: c.signal,
  killSignal: "SIGINT",
});

await wp({ port: PORT });

for (const [{ payload }, pr] of [
  [pushWorkflowJobQueuedFixture],
  [prWorkflowJobQueuedFixture, prPullRequestSynchronizeFixture],
] as const) {
  {
    // workflow_job.queued
    const webhookUrl = new URL("/webhook", serverUrl);
    if (pr) {
      console.log("send pr event");
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
        ["x-github-event", "workflow_job"],
      ],
      body: JSON.stringify(payload),
    });

    assert.deepEqual(await webhookData.json(), { ok: true });
  }

  {
    const env = Object.entries({
      TEST: true,
      GITHUB_SERVER_URL: new URL(payload.workflow_job.html_url).origin,
      GITHUB_REPOSITORY: payload.repository.full_name,
      GITHUB_RUN_ID: payload.workflow_job.run_id,
      GITHUB_RUN_ATTEMPT: payload.workflow_job.run_attempt,
      GITHUB_ACTOR_ID: payload.sender.id,
      GITHUB_SHA: payload.workflow_job.head_sha,
      GITHUB_ACTION: payload.workflow_job.id,
      GITHUB_REF_NAME: pr
        ? `${pr.payload.number}/merge`
        : payload.workflow_job.head_branch,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    })
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");
    await ezSpawn.async(
      `pnpm cross-env ${env} pnpm --filter=playground run publish`,
      [],
      {
        stdio: "inherit",
        shell: true,
      },
    );
  }

  {
    const [owner, repo] = payload.repository.full_name.split("/");
    const ref = pr?.payload.number
      ? "pr-" + pr?.payload.number
      : payload.workflow_job.head_branch;
    // install
    const playgroundShaUrl = new URL(
      `/${owner}/${repo}/playground@${payload.workflow_job.head_sha.substring(0, 7)}`,
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
        `/${owner}/${repo}/playground@${ref}`,
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
        `npx -f playground@${playgroundShaUrl}`,
        {
          stdio: "overlapped",
          shell: true,
        },
      );
      assert.ok(
        playgroundProcess.stdout.includes("playground installed successfully!"),
        "installation failed",
      );
    }
    console.log("success");
  }
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
