import { defineCommand, runMain, parseArgs } from "citty";
import assert from "node:assert";
import path from "path";
import ezSpawn from "@jsdevtools/ez-spawn";
// import { createRequire } from "module";
import { hash } from "ohash";
import fs from "fs/promises";
import { Octokit } from "@octokit/action";
import { pathToFileURL } from "node:url";
import { getPackageManifest } from "query-registry";
import { extractOwnerAndRepo, extractRepository } from "@pkg-pr-new/utils";
import fg from "fast-glob";
import "./environments";
import pkg from "./package.json" with { type: "json" };

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
  GITHUB_SHA,
} = process.env;

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
    version: pkg.version,
    name: "stackblitz",
    description: "A CLI for pkg.pr.new (Continuous Releases)",
  },
  subCommands: {
    publish: () => {
      return {
        args: {
          compact: {
            type: "boolean",
            description:
              "compact urls. The shortest form of urls like pkg.pr.new/tinybench@a832a55)",
          },
        },
        run: async ({ args }) => {
          const compact = !!args.compact;

          const paths = (args._.length ? args._ : ["."])
            .flatMap((p) => (fg.isDynamicPattern(p) ? fg.sync(p) : p))
            .map((p) => path.resolve(p));

          const deps: Map<string, string> = new Map();
          const pJsonContent: Map<string, string> = new Map();
          for (const p of paths) {
            const pJsonPath = path.resolve(p, "package.json");
            const { name } = await importPackageJson(pJsonPath);

            if (compact) {
              await verifyCompactMode(name);
            }

            deps.set(
              name,
              new URL(
                `/${owner}/${repo}/${name}@${GITHUB_SHA.substring(0, 7)}`,
                API_URL,
              ).href,
            );
          }
          for (const p of paths) {
            const pJsonPath = path.resolve(p, "package.json");
            const content = await fs.readFile(pJsonPath, "utf-8");
            pJsonContent.set(pJsonPath, content);

            const pJson = await importPackageJson(pJsonPath);
            hijackDeps(deps, pJson.dependencies);
            hijackDeps(deps, pJson.devDependencies);
            await fs.writeFile(pJsonPath, JSON.stringify(pJson));
          }
          const formData = new FormData();
          for (const p of paths) {
            const pJsonPath = path.resolve(p, "package.json");
            try {
              const { name, version } = await importPackageJson(pJsonPath);
              await ezSpawn.async("npm pack", { stdio: "inherit", cwd: p });

              const fileName = `${name}-${version}.tgz`;
              const file = await fs.readFile(path.resolve(p, fileName));

              const blob = new Blob([file], {
                type: "application/octet-stream",
              });
              formData.append(name, blob, fileName);
            } finally {
              await fs.writeFile(pJsonPath, pJsonContent.get(pJsonPath)!);
            }
          }

          const res = await fetch(publishUrl, {
            method: "POST",
            headers: {
              "sb-compact": `${compact}`,
              "sb-key": key,
              "sb-commit-timestamp": commitTimestamp.toString(),
            },
            body: formData,
          });
          const laterRes = await res.clone().json();
          assert.equal(
            res.status,
            200,
            `publishing failed: ${await res.text()}`,
          );

          console.log(
            `⚡️ Your npm packages are published.\n${[...formData.keys()].map((name, i) => `${name}: \`npm i ${laterRes.urls[i]}\``).join("\n")}`,
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

async function importPackageJson(p: string): Promise<Record<string, any>> {
  const { default: obj } = await import(pathToFileURL(p).href, {
    with: { type: "json" },
  });

  return obj;
}

function hijackDeps(
  newDeps: Map<string, string>,
  oldDeps?: Record<string, string>,
) {
  if (!oldDeps) {
    return;
  }
  for (const [newDep, url] of newDeps) {
    if (newDep in oldDeps) {
      oldDeps[newDep] = url;
    }
  }
}

async function verifyCompactMode(packageName: string) {
  const error = new Error(
    `pkg-pr-new cannot resolve ${packageName} from npm. --compact flag depends on the package being available in npm.
Make sure to have your package on npm first or configure the 'repository' field in your package.json properly.`,
  );
  try {
    const manifest = await getPackageManifest(packageName);

    const repository = extractRepository(manifest);
    if (!repository) {
      throw error;
    }

    const match = extractOwnerAndRepo(repository);
    if (!match) {
      throw error;
    }
  } catch {
    throw error;
  }
}
