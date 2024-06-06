import { defineCommand, runMain } from "citty";
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
import { readPackageJSON, writePackageJSON } from "pkg-types";

declare global {
  var API_URL: string;
}

const apiUrl = process.env.API_URL ?? API_URL
const publishUrl = new URL("/publish", apiUrl);

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

          const {
            GITHUB_REPOSITORY,
            GITHUB_RUN_ID,
            GITHUB_RUN_ATTEMPT,
            GITHUB_ACTOR_ID,
          } = process.env;

          const [owner, repo] = GITHUB_REPOSITORY.split("/");

          const metadata = {
            owner,
            repo,
            run: Number(GITHUB_RUN_ID),
            attempt: Number(GITHUB_RUN_ATTEMPT),
            actor: Number(GITHUB_ACTOR_ID),
          };

          const key = hash(metadata);

          const checkResponse = await fetch(new URL("/check", apiUrl), {
            method: "POST",
            body: JSON.stringify({
              owner,
              repo,
              key,
            }),
          });

          if (!checkResponse.ok) {
            console.log(await checkResponse.text());
            process.exit(1);
          }

          const { sha } = await checkResponse.json();

          const deps: Map<string, string> = new Map();

          for (const p of paths) {
            const pJsonPath = path.resolve(p, "package.json");
            const pJson = await readPackageJSON(pJsonPath);

            if (!pJson.name) {
              throw new Error(`"name" field in ${pJsonPath} should be defined`);
            }

            if (isCompact) {
              await verifyCompactMode(pJson.name);
            }

            deps.set(
              pJson.name,
              new URL(
                `/${owner}/${repo}/${pJson.name}@${sha}`,
                apiUrl,
              ).href,
            );
          }

          for (const templateDir of templates) {
            const pJsonPath = path.resolve(templateDir, "package.json");
            const pJson = await readPackageJSON(pJsonPath);

            if (!pJson.name) {
              throw new Error(`"name" field in ${pJsonPath} should be defined`);
            }

            console.log("preparing template:", pJson.name);

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
                `template:${pJson.name}:${encodeURIComponent(filePath)}`,
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
              const pJson = await readPackageJSON(pJsonPath);

              if (!pJson.name) {
                throw new Error(
                  `"name" field in ${pJsonPath} should be defined`,
                );
              }

              const { filename, shasum } = await resolveTarball(
                isPnpm ? "pnpm" : "npm",
                p,
              );

              shasums[pJson.name] = shasum;
              console.log(`shasum for ${pJson.name}(${filename}): ${shasum}`);

              const file = await fs.readFile(path.resolve(p, filename));

              const blob = new Blob([file], {
                type: "application/octet-stream",
              });
              formData.append(`package:${pJson.name}`, blob, filename);
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
              "sb-run-id": GITHUB_RUN_ID,
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
  const content = await fs.readFile(pJsonPath, "utf-8");

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
