import ezSpawn from "@jsdevtools/ez-spawn";
import { simulation } from "@simulacrum/github-api-simulator";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unstable_dev, type UnstableDevWorker } from "wrangler";
import prPullRequestSynchronizeFixture from "./fixtures/pr.pull_request.json";
import prWorkflowRunRequestedFixture from "./fixtures/pr.workflow_run.requested.json";
import pushWorkflowRunInProgressFixture from "./fixtures/workflow_run.in_progress.json";

const E2E_TEMP_DIR_PREFIX = "pkg-pr-new-e2e-";

let server: Awaited<ReturnType<ReturnType<typeof simulation>["listen"]>>;
let workerUrl: string;
let tempDir: string;
let githubOutputPath: string;

let worker: UnstableDevWorker;

const { stdout: gitHeadSha } = await ezSpawn.async("git rev-parse HEAD", {
  stdio: "overlapped",
});
const fullSha = gitHeadSha.trim();
const sha = fullSha.substring(0, 7);

beforeAll(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), E2E_TEMP_DIR_PREFIX));

  const app = simulation({
    initialState: {
      users: [],
      organizations: [
        { login: "stackblitz-labs" },
        { login: "tinylibs" },
        { login: "stackblitz" },
      ],
      repositories: [
        { owner: "stackblitz-labs", name: "temporary-test" },
        { owner: "stackblitz-labs", name: "pkg.pr.new" },
        { owner: "tinylibs", name: "tinybench" },
        { owner: "stackblitz", name: "sdk" },
      ],
      branches: [{ name: "main" }],
      blobs: [],
    },
  });
  server = await app.listen(3300);

  await ezSpawn.async(
    "pnpm cross-env TEST=true NITRO_GH_BASE_URL=http://localhost:3300 pnpm --filter=app run build",
    [],
    {
      stdio: "inherit",
      shell: true,
    },
  );
  worker = await unstable_dev(
    `${import.meta.dirname}/dist/_worker.js/index.js`,
    {
      config: `${import.meta.dirname}/wrangler.toml`,
      persistTo: path.join(tempDir, "worker"),
    },
  );
  const url = `${worker.proxyData.userWorkerUrl.protocol}//${worker.proxyData.userWorkerUrl.hostname}:${worker.proxyData.userWorkerUrl.port}`;
  workerUrl = url;
  githubOutputPath = path.join(tempDir, "output");
  await fs.writeFile(githubOutputPath, "");

  await ezSpawn.async(
    `pnpm cross-env TEST=true API_URL=${url} pnpm --filter=pkg-pr-new run build`,
    [],
    {
      stdio: "inherit",
      shell: true,
    },
  );
}, 70_000);

afterAll(async () => {
  await server.ensureClose();
  if (tempDir?.includes(E2E_TEMP_DIR_PREFIX)) {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

describe.sequential.each([
  [pushWorkflowRunInProgressFixture],
  [prWorkflowRunRequestedFixture, prPullRequestSynchronizeFixture],
] as const)("webhook endpoints", (...fixture) => {
  const [{ event, payload }, pr] = fixture;
  const mode = pr ? "pr" : "commit";
  it(`handles ${mode} events`, async () => {
    // Send PR event if exists
    if (pr) {
      const prResponse = await worker.fetch("/webhook", {
        method: "POST",
        headers: {
          "x-github-delivery": "d81876a0-e8c4-11ee-8fca-9d3a2baa9707",
          "x-github-event": "pull_request",
        },
        body: JSON.stringify(pr.payload),
      });
      expect(await prResponse.json()).toEqual({ ok: true });
    }

    // Send workflow run event
    const response = await worker.fetch("/webhook", {
      method: "POST",
      headers: {
        "x-github-delivery": "d81876a0-e8c4-11ee-8fca-9d3a2baa9707",
        "x-github-event": event,
      },
      body: JSON.stringify(payload),
    });
    expect(await response.json()).toEqual({ ok: true });
  });

  it(`publishes playgrounds for ${mode}`, async () => {
    const env = Object.entries({
      TEST: true,
      GITHUB_OUTPUT: githubOutputPath,
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

    const process = await ezSpawn.async(
      `pnpm cross-env ${env} pnpm run -w publish:playgrounds`,
      [],
      {
        stdio: "overlapped",
        shell: true,
      },
    );

    expect.soft(process.status).toBe(0);
    expect.soft(process.stdout).toContain(`"owner": "stackblitz-labs"`);
    expect(process.stderr).toContain("preparing template: example-1");
    expect(process.stderr).toContain("preparing template: example-2");
    expect(process.stderr).toContain("Your npm packages are published.");
    expect(process.stderr).toContain("pkg-pr-new:");
    expect(process.stderr).toContain("playground-a:");
    expect(process.stderr).toContain("playground-b:");
  }, 20_000);

  it(`serves and installs playground-a for ${mode}`, async () => {
    const [owner, repo] = payload.repository.full_name.split("/");
    const ref = pr?.payload.number ?? payload.workflow_run.head_branch;

    // Test download with SHA
    const shaResponse = await worker.fetch(
      `/${owner}/${repo}/playground-a@${sha}`,
    );
    expect(shaResponse.status).toBe(200);
    const shaBlob = await shaResponse.blob();
    expect(shaBlob.size).toBeGreaterThan(0);

    // Test download with ref matches SHA content
    const refResponse = await worker.fetch(
      `/${owner}/${repo}/playground-a@${ref}`,
    );
    expect(refResponse.status).toBe(200);
    expect(refResponse.headers.get("x-pkg-name-key")).toBe("playground-a");
    expect(refResponse.headers.get("x-commit-key")).toBe(
      `${owner}:${repo}:${fullSha}`,
    );

    const refBlob = await refResponse.blob();
    const shaBlobSize = await shaBlob.arrayBuffer();
    const refBlobSize = await refBlob.arrayBuffer();
    expect(shaBlobSize.byteLength).toEqual(refBlobSize.byteLength);
    expect(shaBlobSize).toEqual(refBlobSize);

    // Test installation
    const url = new URL(
      `/${owner}/${repo}/playground-a@${sha}?id=${Date.now()}`,
      workerUrl,
    );
    const installProcess = await ezSpawn.async(
      `pnpm cross-env CI=true npx -f playground-a@${url}`,
      {
        stdio: "overlapped",
        shell: true,
      },
    );
    expect(installProcess.stdout).toContain(
      "playground-a installed successfully!",
    );
  }, 20_000);

  it(`returns metadata for HEAD requests (${mode})`, async () => {
    const [owner, repo] = payload.repository.full_name.split("/");

    const headResponse = await worker.fetch(
      `/${owner}/${repo}/playground-a@${sha}`,
      { method: "HEAD" },
    );

    expect(headResponse.status).toBe(200);
    expect(headResponse.headers.get("x-pkg-name-key")).toBe("playground-a");
    expect(headResponse.headers.get("x-commit-key")).toBe(
      `${owner}:${repo}:${sha}`,
    );
    expect(headResponse.headers.get("content-type")).toBe(
      "application/tar+gzip",
    );
    expect(headResponse.headers.get("etag")).toBeDefined();
    const lastModified = headResponse.headers.get("last-modified");
    expect(new Date(lastModified!).toString()).not.toBe("Invalid Date");
  });

  it(`serves and installs playground-b for ${mode}`, async () => {
    const [owner, repo] = payload.repository.full_name.split("/");

    // Test download
    const response = await worker.fetch(
      `/${owner}/${repo}/playground-b@${sha}`,
    );
    expect(response.status).toBe(200);
    const blob = await response.blob();
    expect(blob.size).toBeGreaterThan(0);

    // Test installation
    const url = new URL(
      `/${owner}/${repo}/playground-b@${sha}?id=${Date.now()}`,
      workerUrl,
    );
    const installProcess = await ezSpawn.async(
      `pnpm cross-env CI=true npx -f playground-b@${url}`,
      {
        stdio: "overlapped",
        shell: true,
      },
    );
    expect(installProcess.stdout).toContain(
      "playground-a installed successfully!",
    ); // Should import playground-a
    expect(installProcess.stdout).toContain(
      "playground-b installed successfully!",
    );
  }, 20_000);
});

describe("URL resolution", () => {
  describe("standard packages", () => {
    it.each([
      ["full", "/tinylibs/tinybench/tinybench@a832a55"],
      ["compact", "/tinybench@a832a55"],
      ["with .tgz extension", "/tinybench@a832a55.tgz"],
    ])("resolves %s URLs", async (_, url) => {
      const response = await worker.fetch(url);

      expect(response.headers.get("x-commit-key")).toBe(
        "tinylibs:tinybench:a832a55",
      );
      expect(response.headers.get("x-pkg-name-key")).toBe("tinybench");
    });

    it("resolves URL with full Git SHA", async () => {
      const response = await worker.fetch(
        "/tinylibs/tinybench/tinybench@a832a55e8f50c419ed8414024899e37e69b1f999",
      );

      expect(response.headers.get("x-pkg-name-key")).toBe("tinybench");
      expect(response.headers.get("x-commit-key")).toBe(
        "tinylibs:tinybench:a832a55e8f50c419ed8414024899e37e69b1f999",
      );
    });
  });

  describe("scoped packages", () => {
    it.each([
      ["full", "/stackblitz/sdk/@stackblitz/sdk@a832a55"],
      ["encoded", "/stackblitz/sdk/%40stackblitz%2Fsdk@a832a55"],
      ["compact", "/@stackblitz/sdk@a832a55"],
      ["compact encoded", "/%40stackblitz%2Fsdk@a832a55"],
    ])("resolves %s URLs", async (_, url) => {
      const response = await worker.fetch(url);

      expect(response.headers.get("x-pkg-name-key")).toBe("@stackblitz:sdk");
      expect(response.headers.get("x-commit-key")).toBe(
        "stackblitz:sdk:a832a55",
      );
    });

    it("resolves URL with full Git SHA", async () => {
      const response = await worker.fetch(
        "/stackblitz/sdk/@stackblitz/sdk@a832a55e8f50c419ed8414024899e37e69b1f999",
      );

      expect(response.headers.get("x-pkg-name-key")).toBe("@stackblitz:sdk");
      expect(response.headers.get("x-commit-key")).toBe(
        "stackblitz:sdk:a832a55e8f50c419ed8414024899e37e69b1f999",
      );
    });
  });
});
