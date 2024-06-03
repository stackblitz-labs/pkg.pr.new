import { defineCommand, runMain, parseArgs } from "citty";
import assert from "node:assert";
import path from "path";
import ezSpawn from "@jsdevtools/ez-spawn";
import { createHash } from "node:crypto";
import { hash } from "ohash";
import fsSync from "fs";
import fs from "fs/promises";
import { Octokit } from "@octokit/action";
import { getPackageManifest } from "query-registry";
import { extractOwnerAndRepo, extractRepository } from "@pkg-pr-new/utils";
import fg from "fast-glob";
import ignore from "ignore";
import "./environments";
import pkg from "./package.json" with { type: "json" };
import { isBinaryFile } from "isbinaryfile";
import {
  readPackageJSON,
  writePackageJSON,
  resolvePackageJSON,
} from "pkg-types";

declare global {
  var API_URL: string;
}

const publishUrl = new URL("/publish", API_URL);

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
          pnpm: {
            type: "boolean",
            description: "use `pnpm pack` instead of `npm pack --json`",
          },
          template: {
            type: "string",
            description:
              "generate stackblitz templates out of directories in the current repo with the new built packages",
          },
        },
        run: async ({ args }) => {
          const paths = (args._.length ? args._ : ["."])
            .flatMap((p) => (fg.isDynamicPattern(p) ? fg.sync(p) : p))
            .map((p) => path.resolve(p));

          const templates = (
            typeof args.template === "string"
              ? [args.template]
              : ([...(args.template ?? [])] as string[])
          )
            .flatMap((p) => (fg.isDynamicPattern(p) ? fg.sync(p) : p))
            .map((p) => path.resolve(p));

          const formData = new FormData();

          const isCompact = !!args.compact;
          const isPnpm = !!args.pnpm;

          if (!process.env.TEST && process.env.GITHUB_ACTIONS !== "true") {
            console.error(
              "Continuous Releases are only available in Github Actions.",
            );
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

          // Note: If you need to use a workflow run's URL from within a job, you can combine these variables: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID
          const url = `${GITHUB_SERVER_URL}/${owner}/${repo}/actions/runs/${GITHUB_RUN_ID}`;

          const metadata = {
            url,
            attempt: Number(GITHUB_RUN_ATTEMPT),
            actor: Number(GITHUB_ACTOR_ID),
          };

          const key = hash(metadata);

          const checkResponse = await fetch(new URL("/check", API_URL), {
            method: "POST",
            body: JSON.stringify({
              owner,
              repo,
            }),
          });

          if (!checkResponse.ok) {
            console.log(await checkResponse.text());
            process.exit(1);
          }

          const commit = await octokit.git.getCommit({
            owner,
            repo,
            commit_sha: GITHUB_SHA,
          });

          const commitTimestamp = Date.parse(commit.data.committer.date);

          const deps: Map<string, string> = new Map();

          for (const p of paths) {
            const pJsonPath = path.resolve(p, "package.json");
            const { name } = await readPackageJSON(pJsonPath);
            if (!name) {
              throw new Error(`"name" field in ${pJsonPath} should be defined`);
            }

            if (isCompact) {
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

          for (const templateDir of templates) {
            const pJsonPath = path.resolve(templateDir, "package.json");
            const { name } = await readPackageJSON(pJsonPath);
            console.log("preparing template:", name);

            const restore = await writeDeps(templateDir, deps);

            const gitignorePath = path.join(templateDir, ".gitignore");
            const ig = ignore();
            ig.add("node_modules");

            if (fsSync.existsSync(gitignorePath)) {
              const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
              ig.add(gitignoreContent);
            }

            const files = await fg(["**/*"], {
              cwd: templateDir,
              dot: true,
              onlyFiles: true,
            });

            const filteredFiles = files.filter((file) => !ig.ignores(file));

            for (const filePath of filteredFiles) {
              const file = await fs.readFile(path.join(templateDir, filePath));
              const isBinary = await isBinaryFile(file);
              const blob = new Blob([file.buffer], {
                type: "application/octet-stream",
              });
              formData.append(
                `template:${name}:${encodeURIComponent(filePath)}`,
                isBinary ? blob : await blob.text(),
              );
            }
            await restore();
          }

          const restoreMap = new Map<
            string,
            Awaited<ReturnType<typeof writeDeps>>
          >();
          for (const p of paths) {
            restoreMap.set(p, await writeDeps(p, deps));
          }

          const shasums: Record<string, string> = {};
          for (const p of paths) {
            const pJsonPath = path.resolve(p, "package.json");
            try {
              const { name } = await readPackageJSON(pJsonPath);

              const { filename, shasum } = await resolveTarball(
                isPnpm ? "pnpm" : "npm",
                p,
              );

              shasums[name!] = shasum;
              console.log(`shasum for ${name}(${filename}): ${shasum}`);

              const file = await fs.readFile(path.resolve(p, filename));

              const blob = new Blob([file], {
                type: "application/octet-stream",
              });
              formData.append(`package:${name}`, blob, filename);
            } finally {
              await restoreMap.get(pJsonPath)?.();
            }
          }

          const res = await fetch(publishUrl, {
            method: "POST",
            headers: {
              "sb-compact": `${isCompact}`,
              "sb-key": key,
              "sb-shasums": JSON.stringify(shasums),
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

          console.log("\n");
          console.log(
            `⚡️ Your npm packages are published.\n${[...formData.keys()]
              .filter((k) => k.startsWith("package:"))
              .map(
                (name, i) =>
                  `${name.slice("package:".length)}: npm i ${laterRes.urls[i]}`,
              )
              .join("\n")}`,
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

// TODO: we'll add support for yarn if users hit issues with npm
async function resolveTarball(pm: "npm" | "pnpm", p: string) {
  if (pm === "npm") {
    const { stdout } = await ezSpawn.async("npm pack --json", {
      stdio: "overlapped",
      cwd: p,
    });

    const { filename, shasum }: { filename: string; shasum: string } =
      JSON.parse(stdout)[0];

    return { filename, shasum };
  } else if (pm === "pnpm") {
    const { stdout } = await ezSpawn.async("pnpm pack", {
      stdio: "overlapped",
      cwd: p,
    });
    const filename = stdout.trim();

    const shasum = createHash("sha1")
      .update(await fs.readFile(path.resolve(p, filename)))
      .digest("hex");

    return { filename, shasum };
  }
  throw new Error("Could not resolve package manager");
}

async function writeDeps(p: string, deps: Map<string, string>) {
  const pJsonPath = path.resolve(p, "package.json");
  const content = await resolvePackageJSON(pJsonPath);

  const pJson = await readPackageJSON(pJsonPath);

  hijackDeps(deps, pJson.dependencies);
  hijackDeps(deps, pJson.devDependencies);
  await writePackageJSON(pJsonPath, pJson);

  return () => fs.writeFile(pJsonPath, content);
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
