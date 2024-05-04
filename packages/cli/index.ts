import { defineCommand, runMain } from "citty";
import assert from "node:assert";
import path from "path";
import ezSpawn from "@jsdevtools/ez-spawn";
// import { createRequire } from "module";
import { hash } from "ohash";
import fs from "fs/promises";
import { Octokit } from "@octokit/action";
import { pathToFileURL } from "node:url";
import "./environments";

const {
  default: { name, version },
} = await import(
  pathToFileURL(path.resolve(process.cwd(), "package.json")).href,
  { with: { type: "json" } }
);

declare global {
  var API_URL: string;
}

const publishUrl = new URL("/publish", API_URL);

if (!process.env.TEST && process.env.GITHUB_ACTIONS !== "true") {
  console.error("Continuous Releases are only available in Github Actions.");
  process.exit(1);
}
const octokit = new Octokit();

const {
  GITHUB_SERVER_URL,
  GITHUB_REPOSITORY,
  GITHUB_RUN_ID,
  GITHUB_RUN_ATTEMPT,
  GITHUB_ACTOR_ID,
  GITHUB_REF_NAME,
  GITHUB_SHA,
} = process.env;

let ref = GITHUB_REF_NAME.split("/merge")[0];
const isPullRequest = GITHUB_REF_NAME.endsWith("/merge");

if (isPullRequest) {
  ref = "pr-" + ref;
}

const [owner, repo] = GITHUB_REPOSITORY.split("/");

const commit = await octokit.git.getCommit({
  owner,
  repo,
  commit_sha: GITHUB_SHA,
});

const commitTimestamp = Date.parse(commit.data.committer.date);

// Note: If you need to use a workflow run's URL from within a job, you can combine these variables: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID
const url = `${GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${GITHUB_RUN_ID}`;

const metadata = {
  url,
  attempt: Number(GITHUB_RUN_ATTEMPT),
  actor: Number(GITHUB_ACTOR_ID),
};

const key = hash(metadata);

const main = defineCommand({
  meta: {
    version,
    name: "stackblitz",
    description: "A CLI for pkg.pr.new (Continuous Releases)",
  },
  subCommands: {
    publish: () => {
      return {
        meta: {},
        run: async () => {
          await ezSpawn.async("npm pack", { stdio: "inherit" });

          const file = await fs.readFile(`${name}-${version}.tgz`);
          console.log('headers', {
            headers: {
              "sb-key": key,
              "sb-package-name": name,
              "sb-package-version": version,
              "sb-commit-timestamp": commitTimestamp.toString(),
            },
          })

          const res = await fetch(publishUrl, {
            method: "POST",
            headers: {
              "sb-key": key,
              "sb-package-name": name,
              "sb-package-version": version,
              "sb-commit-timestamp": commitTimestamp.toString(),
            },
            body: file,
          });
          const laterRes = res.clone();
          assert.equal(
            res.status,
            200,
            `publishing failed: ${await res.text()}`,
          );

          console.log(
            `⚡️ Your npm package is published: \`npm i ${(await laterRes.json()).url}\``,
          );
        },
      };
    },
    link: () => {
      return {
        meta: {},
        run: () => {},
      };
    },
  },
});

runMain(main);
