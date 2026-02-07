/* eslint-disable unicorn/no-process-exit */
import path from "node:path";
import { createHash } from "node:crypto";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import { hash } from "ohash";
import ezSpawn from "@jsdevtools/ez-spawn";
import { defineCommand, runMain } from "citty";
import { getPackageManifest, type PackageManifest } from "query-registry";
import type { Comment } from "@pkg-pr-new/utils";
import {
  abbreviateCommitHash,
  extractOwnerAndRepo,
  extractRepository,
  installCommands,
} from "@pkg-pr-new/utils";
import { glob } from "tinyglobby";
import ignore from "ignore";
import "./environments";
import { isBinaryFile } from "isbinaryfile";
import { writePackageJSON, type PackageJson } from "pkg-types";
import pkg from "./package.json" with { type: "json" };
import { createDefaultTemplate } from "./template";
import * as core from "@actions/core";

declare global {
  const API_URL: string;
}

type OutputMetadata = {
  packages: {
    name: string;
    url: string;
    shasum: string;
  }[];
  templates: {
    name: string;
    url: string;
  }[];
};

const apiUrl = process.env.API_URL ?? API_URL;
const publishUrl = new URL("/publish", apiUrl);
const createMultipart = new URL("/multipart/create", apiUrl);
const uploadMultipart = new URL("/multipart/upload", apiUrl);
const completeMultipart = new URL("/multipart/complete", apiUrl);

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
              "compact urls (default). The shortest form of urls like pkg.pr.new/tinybench@a832a55)",
          },
          peerDeps: {
            type: "boolean",
            description:
              "handle peerDependencies by setting the workspace version instead of what has been set in the peerDeps itself. --peerDeps not being true would leave peerDependencies to the package manager itself (npm, pnpm)",
            default: false,
          },
          pnpm: {
            type: "boolean",
            description: "use `pnpm pack` instead of `npm pack --json`",
          },
          yarn: {
            type: "boolean",
            description: "use `yarn pack` instead of `npm pack --json`",
          },
          bun: {
            type: "boolean",
            description: "use `bun pm pack` instead of `npm pack --json`",
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
          commentWithSha: {
            type: "boolean",
            description:
              "use commit sha instead of the pr number in the comment links",
            default: false,
          },
          commentWithDev: {
            type: "boolean",
            description:
              "should install the packages with the 'dev' tag in the comment links",
            default: false,
          },
          "only-templates": {
            type: "boolean",
            description: `generate only stackblitz templates`,
            default: false,
          },
          json: {
            type: "mixed",
            description: `Save metadata to a JSON file. If true, log the output for piping. If a string, save the output to the specified file path.`,
          },
          packageManager: {
            type: "string",
            description:
              "Specify the package manager to use (npm, bun, pnpm, yarn). Comma-separated values are supported.",
            enum: ["npm", "bun", "pnpm", "yarn"],
            default: "npm",
          },
          bin: {
            type: "boolean",
            description:
              "Set to true if your package is a binary application and you would like to show an execute command instead of an install command.",
          },
        },
        run: async ({ args }) => {
          const paths =
            args._.length > 0
              ? await glob(args._, {
                  expandDirectories: false,
                  onlyDirectories: true,
                  absolute: true,
                })
              : [process.cwd()];

          const templates = await glob(args.template || [], {
            expandDirectories: false,
            onlyDirectories: true,
            absolute: true,
          });

          const formData = new FormData();

          let isCompact = args.compact !== false;
          let packMethod: PackMethod = "npm";

          if (args.pnpm) {
            packMethod = "pnpm";
          } else if (args.yarn) {
            packMethod = "yarn";
          } else if (args.bun) {
            packMethod = "bun";
          }

          const isPeerDepsEnabled = !!args.peerDeps;
          const isOnlyTemplates = !!args["only-templates"];
          const isBinaryApplication = !!args.bin;
          const isCommentWithSha = !!args.commentWithSha;
          const isCommentWithDev = !!args.commentWithDev;
          const comment: Comment = args.comment as Comment;
          const selectedPackageManager = [
            ...new Set(
              (args.packageManager as string)
                .split(",")
                .filter((s) => s.trim()) as Array<
                "npm" | "bun" | "pnpm" | "yarn"
              >,
            ),
          ];
          const packageManagers = ["npm", "bun", "pnpm", "yarn"];

          if (!selectedPackageManager.length) {
            console.error(
              `Unsupported package manager: ${args.packageManager}. Supported managers are npm, bun, pnpm, yarn.`,
            );
            process.exit(1);
          }
          for (let i = 0; i < selectedPackageManager.length; i++) {
            if (!packageManagers.includes(selectedPackageManager[i])) {
              console.error(
                `Unsupported package manager: ${selectedPackageManager[i]}. Supported managers are npm, bun, pnpm, yarn.`,
              );
              process.exit(1);
            }
          }

          if (!process.env.TEST && process.env.GITHUB_ACTIONS !== "true") {
            console.error(
              "Continuous Releases are only available in GitHub Actions.",
            );
            process.exit(1);
          }

          const {
            GITHUB_REPOSITORY,
            GITHUB_RUN_ID,
            GITHUB_RUN_ATTEMPT,
            GITHUB_ACTOR_ID,
            GITHUB_OUTPUT,
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

          let checkResponse;
          try {
            checkResponse = await fetch(new URL("/check", apiUrl), {
              method: "POST",
              body: JSON.stringify({
                owner,
                repo,
                key,
              }),
            });
          } catch (error) {
            console.error(`Failed to connect to server: ${error}`);
            process.exit(1);
          }

          if (!checkResponse.ok) {
            const errorText = await checkResponse.text();
            console.error(
              `Check failed (${checkResponse.status}): ${errorText}`,
            );
            process.exit(1);
          }

          const { sha } = await checkResponse.json();

          const deps: Map<string, string> = new Map(); // pkg.pr.new versions of the package
          const realDeps: Map<string, string> | null = isPeerDepsEnabled
            ? new Map()
            : null; // real versions of the package, useful for peerDependencies

          const printJson = typeof args.json === "boolean";
          const saveJson = typeof args.json === "string";
          const jsonFilePath = saveJson ? args.json : "";
          const outputMetadata: OutputMetadata = {
            packages: [],
            templates: [],
          };

          const packageInfos: Array<{
            packageName: string;
            pJson: PackageJson;
          }> = [];

          for (const p of paths) {
            const pJsonPath = path.resolve(p, "package.json");
            const pJson = await readPackageJson(pJsonPath);

            if (!pJson) {
              continue;
            }

            if (!pJson.name) {
              throw new Error(`"name" field in ${pJsonPath} should be defined`);
            }
            if (pJson.private) {
              continue;
            }

            const packageName = pJson.name;
            packageInfos.push({ packageName, pJson });
          }

          if (isCompact) {
            for (const { packageName } of packageInfos) {
              try {
                await verifyCompactMode(packageName);
              } catch (error) {
                const reason =
                  error instanceof Error ? error.message : String(error);
                console.warn(
                  `Package ${packageName} cannot use --compact (${reason}). Falling back to non-compact URLs for this run.`,
                );
                isCompact = false;
                break;
              }
            }
          }

          const formattedSha = isCompact ? abbreviateCommitHash(sha) : sha;

          for (const { packageName, pJson } of packageInfos) {
            const longDepUrl = new URL(
              `/${owner}/${repo}/${packageName}@${formattedSha}`,
              apiUrl,
            ).href;
            deps.set(packageName, longDepUrl);
            realDeps?.set(packageName, pJson.version ?? longDepUrl);

            const controller = new AbortController();
            try {
              const resource = await fetch(longDepUrl, {
                signal: controller.signal,
              });
              if (resource.ok) {
                console.warn(
                  `${pJson.name}@${formattedSha} was already published on ${longDepUrl}`,
                );
              } else if (resource.status >= 500) {
                console.warn(
                  `Server error checking ${longDepUrl} (${resource.status}), proceeding with publish`,
                );
              }
            } catch (error) {
              console.warn(
                `Failed to check if package exists at ${longDepUrl}: ${error}`,
              );
            }
            controller.abort();

            const jsonUrl = isCompact
              ? new URL(`/${packageName}@${formattedSha}`, apiUrl).href
              : longDepUrl;

            // Collect package metadata
            outputMetadata.packages.push({
              name: packageName,
              url: jsonUrl,
              shasum: "", // will be filled later
            });
          }

          for (const templateDir of templates) {
            const pJsonPath = path.resolve(templateDir, "package.json");
            const pJsonContents = await tryReadFile(pJsonPath);
            const pJson = pJsonContents
              ? parsePackageJson(pJsonContents)
              : null;

            if (!pJson || !pJsonContents) {
              console.warn(
                `skipping ${templateDir} because there's no package.json file`,
              );
              continue;
            }

            if (!pJson.name) {
              throw new Error(`"name" field in ${pJsonPath} should be defined`);
            }

            console.warn("preparing template:", pJson.name);

            const restore = await writeDeps(
              templateDir,
              pJsonContents,
              pJson,
              deps,
              realDeps,
            );

            const gitignorePath = path.join(templateDir, ".gitignore");
            const ig = ignore().add("node_modules").add(".git");

            if (fsSync.existsSync(gitignorePath)) {
              const gitignoreContent = await fs.readFile(gitignorePath, "utf8");
              ig.add(gitignoreContent);
            }

            const files = await glob(["**/*"], {
              cwd: templateDir,
              dot: true,
              onlyFiles: true,
              ignore: ["**/node_modules", ".git"], // always ignore node_modules and .git
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

            // Collect template metadata
            const templateUrl = new URL(
              `/${owner}/${repo}/template/${pJson.name}`,
              apiUrl,
            ).href;
            outputMetadata.templates.push({
              name: pJson.name,
              url: templateUrl,
            });
          }

          const noDefaultTemplate = args.template === false;

          if (!noDefaultTemplate && templates.length === 0) {
            const project = createDefaultTemplate(
              Object.fromEntries(deps.entries()),
              isCommentWithDev,
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
            const pJsonPath = path.resolve(p, "package.json");
            const pJsonContents = await tryReadFile(pJsonPath);
            const pJson = pJsonContents
              ? parsePackageJson(pJsonContents)
              : null;

            if (!pJson || !pJsonContents) {
              continue;
            }

            if (pJson.private) {
              continue;
            }

            restoreMap.set(
              p,
              await writeDeps(p, pJsonContents, pJson, deps, realDeps),
            );
          }

          const shasums: Record<string, string> = {};
          for (const p of paths) {
            const pJsonPath = path.resolve(p, "package.json");
            const pJson = await readPackageJson(pJsonPath);
            if (!pJson) {
              console.warn(
                `skipping ${p} because there's no package.json file`,
              );
              continue;
            }

            try {
              if (!pJson.name) {
                throw new Error(
                  `"name" field in ${pJsonPath} should be defined`,
                );
              }
              if (pJson.private) {
                console.warn(`skipping ${p} because the package is private`);
                continue;
              }

              const { filename, shasum } = await resolveTarball(
                packMethod,
                p,
                pJson,
              );

              shasums[pJson.name] = shasum;

              const outputPkg = outputMetadata.packages.find(
                (p) => p.name === pJson.name,
              )!;
              outputPkg.shasum = shasum;

              const filePath = path.resolve(p, filename);
              const buffer = await fs.readFile(filePath);

              const blob = new Blob([buffer], {
                type: "application/octet-stream",
              });
              formData.append(`package:${pJson.name}`, blob, filename);

              await fs.rm(filePath);
            } finally {
              await restoreMap.get(p)?.();
            }
          }

          const formDataPackagesSize = [...formData.entries()].reduce(
            (prev, [, entry]) => prev + getFormEntrySize(entry),
            0,
          );

          // multipart uploading
          if (formDataPackagesSize > 1024 * 1024 * 99) {
            for (const [name, entry] of formData) {
              if (name.startsWith("package:")) {
                const file = entry as File;
                const chunkSize = 1024 * 1024 * 5;
                if (file.size <= chunkSize) {
                  continue;
                }
                const totalChunks = Math.ceil(file.size / chunkSize);
                const createMultipartRes = await fetch(createMultipart, {
                  method: "POST",
                  headers: {
                    "sb-key": key,
                    "sb-name": name.slice("package:".length),
                  },
                });
                if (!createMultipartRes.ok) {
                  console.error(await createMultipartRes.text());
                  continue;
                }
                const { key: uploadKey, id: uploadId } =
                  await createMultipartRes.json();

                interface R2UploadedPart {
                  partNumber: number;
                  etag: string;
                }
                const uploadedParts: R2UploadedPart[] = [];

                for (let i = 0; i < totalChunks; i++) {
                  const start = i * chunkSize;
                  const end = Math.min(file.size, start + chunkSize);
                  const chunk = file.slice(start, end);

                  const uploadMultipartRes = await fetch(uploadMultipart, {
                    method: "PUT",
                    headers: {
                      key: uploadKey,
                      id: uploadId,
                      "part-number": `${i + 1}`,
                    },
                    body: chunk,
                  });

                  if (!uploadMultipartRes.ok) {
                    console.error(
                      `Error uploading part ${i + 1}: ${await uploadMultipartRes.text()}`,
                    );
                    break;
                  }
                  const { part } = await uploadMultipartRes.json();
                  uploadedParts.push(part);
                }
                const completeMultipartRes = await fetch(completeMultipart, {
                  method: "POST",
                  headers: {
                    key: uploadKey,
                    id: uploadId,
                    "uploaded-parts": JSON.stringify(uploadedParts),
                  },
                });
                if (!completeMultipartRes.ok) {
                  console.error(
                    `Error completing ${key}: ${await completeMultipartRes.text()}`,
                  );
                  break;
                }
                const { key: completionKey } =
                  await completeMultipartRes.json();

                formData.set(name, `object:${completionKey}`);
              }
            }
          }

          const res = await fetch(publishUrl, {
            method: "POST",
            headers: {
              "sb-comment": comment,
              "sb-compact": `${isCompact}`,
              "sb-key": key,
              "sb-shasums": JSON.stringify(shasums),
              "sb-run-id": GITHUB_RUN_ID,
              "sb-bin": `${isBinaryApplication}`,
              "sb-package-manager": selectedPackageManager.join(","),
              "sb-only-templates": `${isOnlyTemplates}`,
              "sb-comment-with-sha": `${isCommentWithSha}`,
              "sb-comment-with-dev": `${isCommentWithDev}`,
            },
            body: formData,
          });

          if (!res.ok) {
            const errorText = await res.text();
            console.error(`Publishing failed (${res.status}): ${errorText}`);
            process.exit(1);
          }

          let laterRes;
          try {
            laterRes = await res.json();
          } catch (error) {
            console.error(`Failed to parse server response as JSON: ${error}`);
            console.error(`Raw response: ${await res.text()}`);
            process.exit(1);
          }

          const debug = laterRes.debug;

          core.startGroup("🔍 Info");
          core.notice(JSON.stringify(debug, null, 2));
          core.endGroup();

          console.warn("\n");
          console.warn("⚡️ Your npm packages are published.\n");

          const packageLogs = [...formData.keys()]
            .filter((k) => k.startsWith("package:"))
            .map((name, i) => {
              const packageName = name.slice("package:".length);
              const url = new URL(laterRes.urls[i]);
              const publintUrl = new URL(
                `/pkg.pr.new${url.pathname}`,
                "https://publint.dev",
              );
              return `${packageName}:
- sha: ${shasums[packageName]}
- publint: ${publintUrl}
- ${packMethod}: ${installCommands[packMethod]} ${url}`;
            })
            .join("\n\n");

          console.warn(packageLogs);

          const output = JSON.stringify(outputMetadata, null, 2);
          if (printJson) {
            console.log(output); // Log output for piping
          }
          if (saveJson) {
            await fs.writeFile(jsonFilePath, output);
            console.warn(`metadata written to ${jsonFilePath}`);
          }

          await fs.appendFile(GITHUB_OUTPUT, `sha=${formattedSha}\n`, "utf8");
          await fs.appendFile(
            GITHUB_OUTPUT,
            `urls=${outputMetadata.packages.map((pkg) => pkg.url).join(" ")}\n`,
            "utf8",
          );
          await fs.appendFile(
            GITHUB_OUTPUT,
            `packages=${outputMetadata.packages.map((pkg) => `${pkg.name}@${pkg.url}`).join(" ")}\n`,
            "utf8",
          );
        },
      };
    },
    link: () => {
      return {
        meta: {},
        run: () => {
          // noop
        },
      };
    },
  },
});

runMain(main)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

type PackMethod = "npm" | "pnpm" | "yarn" | "bun";

async function resolveTarball(pm: PackMethod, p: string, pJson: PackageJson) {
  let cmd = `${pm} pack`;
  let filename = `${pJson.name!.replace("/", "-")}-${pJson.version}.tgz`;
  if (pm === "yarn") {
    cmd += ` --filename ${filename}`;
  } else if (pm === "bun") {
    cmd = `bun pm pack --filename ${filename}`;
  }
  const { stdout } = await ezSpawn.async(cmd, {
    stdio: "overlapped",
    cwd: p,
  });
  const lines = stdout.split("\n").filter(Boolean);

  if (pm !== "yarn" && pm !== "bun") {
    filename = lines[lines.length - 1].trim();
  }

  const shasum = createHash("sha1")
    .update(await fs.readFile(path.resolve(p, filename)))
    .digest("hex");

  return { filename, shasum };
}

async function writeDeps(
  p: string,
  pJsonContents: string,
  pJson: PackageJson,
  deps: Map<string, string>,
  realDeps: Map<string, string> | null,
) {
  const pJsonPath = path.resolve(p, "package.json");

  hijackDeps(deps, pJson.dependencies);
  hijackDeps(deps, pJson.devDependencies);
  hijackDeps(deps, pJson.optionalDependencies);

  if (realDeps) {
    hijackDeps(realDeps, pJson.peerDependencies);
  }

  await writePackageJSON(pJsonPath, pJson);

  return () => fs.writeFile(pJsonPath, pJsonContents);
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

function getFormEntrySize(entry: FormDataEntryValue) {
  if (typeof entry === "string") {
    return entry.length;
  }
  return entry.size;
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

async function tryReadFile(p: string) {
  try {
    return await fs.readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function readPackageJson(p: string) {
  const contents = await tryReadFile(p);
  if (contents === null) {
    return null;
  }
  try {
    return parsePackageJson(contents);
  } catch {
    return null;
  }
}

function parsePackageJson(contents: string) {
  try {
    return JSON.parse(contents) as PackageJson;
  } catch {
    return null;
  }
}
