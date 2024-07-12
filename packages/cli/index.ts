import { defineCommand, runMain } from "citty";
import assert from "node:assert";
import path from "path";
import ezSpawn from "@jsdevtools/ez-spawn";
import { createHash } from "node:crypto";
import { hash } from "ohash";
import fsSync from "fs";
import fs from "fs/promises";
import { detect } from "detect-package-manager";
import { getPackageManifest, type PackageManifest } from "query-registry";
import type { Comment } from "@pkg-pr-new/utils";
import {
  abbreviateCommitHash,
  extractOwnerAndRepo,
  extractRepository,
} from "@pkg-pr-new/utils";
import fg from "fast-glob";
import ignore from "ignore";
import "./environments";
import pkg from "./package.json" with { type: "json" };
import { isBinaryFile } from "isbinaryfile";
import { readPackageJSON, writePackageJSON } from "pkg-types";
import { createDefaultTemplate } from "./template";

declare global {
  var API_URL: string;
}

const apiUrl = process.env.API_URL ?? API_URL;
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
          comment: {
            type: "string", // "off", "create", "update" (default)
            description: `"off" for no comments (silent mode). "create" for comment on each publish. "update" for one comment across the pull request with edits on each publish (default)`,
            default: "update",
          },
        },
        run: async ({ args }) => {
          const paths = (args._.length ? args._ : ["."])
            .flatMap((p) => fg.sync(p, { onlyDirectories: true }))
            .map((p) => path.resolve(p.trim()));

          const templates = (
            typeof args.template === "string"
              ? [args.template]
              : ([...(args.template || [])] as string[])
          )
            .flatMap((p) => fg.sync(p, { onlyDirectories: true }))
            .map((p) => path.resolve(p.trim()));

          const formData = new FormData();

          const isCompact = !!args.compact;
          const isPnpm = !!args.pnpm;

          const comment: Comment = args.comment as Comment;

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
          const abbreviatedSha = abbreviateCommitHash(sha);

          const deps: Map<string, string> = new Map();

          for (const p of paths) {
            if (!(await hasPackageJson(p))) {
              continue;
            }
            const pJsonPath = path.resolve(p, "package.json");
            const pJson = await readPackageJSON(pJsonPath);

            if (!pJson.name) {
              throw new Error(`"name" field in ${pJsonPath} should be defined`);
            }
            if (pJson.private) {
              continue;
            }

            if (isCompact) {
              await verifyCompactMode(pJson.name);
            }

            deps.set(
              pJson.name,
              new URL(
                `/${owner}/${repo}/${pJson.name}@${abbreviatedSha}`,
                apiUrl,
              ).href,
            );
          }

          for (const templateDir of templates) {
            if (!(await hasPackageJson(templateDir))) {
              console.log(
                `skipping ${templateDir} because there's no package.json file`,
              );
              continue;
            }
            const pJsonPath = path.resolve(templateDir, "package.json");
            const pJson = await readPackageJSON(pJsonPath);

            if (!pJson.name) {
              throw new Error(`"name" field in ${pJsonPath} should be defined`);
            }

            console.log("preparing template:", pJson.name);

            const restore = await writeDeps(templateDir, deps);

            const gitignorePath = path.join(templateDir, ".gitignore");
            const ig = ignore()
              .add("node_modules")
              .add(".git");

            if (fsSync.existsSync(gitignorePath)) {
              const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
              ig.add(gitignoreContent);
            }

            const files = await fg(["**/*"], {
              cwd: templateDir,
              dot: true,
              onlyFiles: true,
              ignore: ['node_modules', '.git'], // always ignore node_modules and .git
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

          const noDefaultTemplate = args.template === false;

          if (!templates.length && !noDefaultTemplate) {
            const project = createDefaultTemplate(
              Object.fromEntries(deps.entries()),
            );

            for (const filePath of Object.keys(project)) {
              formData.append(
                `template:default:${encodeURIComponent(filePath)}`,
                project[filePath],
              );
            }
          }

          const restoreMap = new Map<
            string,
            Awaited<ReturnType<typeof writeDeps>>
          >();
          for (const p of paths) {
            if (!(await hasPackageJson(p))) {
              continue;
            }
            const pJsonPath = path.resolve(p, "package.json");
            const pJson = await readPackageJSON(pJsonPath);

            if (pJson.private) {
              continue;
            }

            restoreMap.set(p, await writeDeps(p, deps));
          }

          const shasums: Record<string, string> = {};
          for (const p of paths) {
            if (!(await hasPackageJson(p))) {
              console.log(`skipping ${p} because there's no package.json file`);
              continue;
            }
            const pJsonPath = path.resolve(p, "package.json");
            try {
              const pJson = await readPackageJSON(pJsonPath);

              if (!pJson.name) {
                throw new Error(
                  `"name" field in ${pJsonPath} should be defined`,
                );
              }
              if (pJson.private) {
                console.log(`skipping ${p} because the package is private`);
                continue;
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
              await restoreMap.get(p)?.();
            }
          }

          const packageManager = await detect();
          const res = await fetch(publishUrl, {
            method: "POST",
            headers: {
              "sb-comment": comment,
              "sb-compact": `${isCompact}`,
              "sb-key": key,
              "sb-shasums": JSON.stringify(shasums),
              "sb-run-id": GITHUB_RUN_ID,
              "sb-package-manager": packageManager,
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
  const { stdout } = await ezSpawn.async(`${pm} pack`, {
    stdio: "overlapped",
    cwd: p,
  });
  const lines = stdout.split("\n").filter(Boolean);
  const filename = lines[lines.length - 1].trim();

  const shasum = createHash("sha1")
    .update(await fs.readFile(path.resolve(p, filename)))
    .digest("hex");

  return { filename, shasum };
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
  let manifest: PackageManifest;

  try {
    manifest = await getPackageManifest(packageName);
  } catch {
    throw new Error(
      `pkg-pr-new cannot resolve ${packageName} from npm. --compact flag depends on the package being available in npm.
Make sure to have your package on npm first.`,
    );
  }

  const instruction = `Make sure to configure the 'repository' / 'repository.url' field in its package.json properly.
See https://docs.npmjs.com/cli/v10/configuring-npm/package-json#repository for details.`;

  const repository = extractRepository(manifest);
  if (!repository) {
    throw new Error(
      `pkg-pr-new cannot extract the repository link from the ${packageName} manifest. --compact flag requires the link to be present.
${instruction}`,
    );
  }

  const match = extractOwnerAndRepo(repository);
  if (!match) {
    throw new Error(
      `pkg-pr-new cannot extract the owner and repo names from the ${packageName} repository link: ${repository}. --compact flag requires these names.
${instruction}`,
    );
  }
}

async function hasPackageJson(p: string) {
  try {
    await fs.access(path.resolve(p, "package.json"), fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
