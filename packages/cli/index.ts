import assert from "node:assert";
import path from "path";
import ezSpawn from "@jsdevtools/ez-spawn";
import { createHash } from "node:crypto";
import { hash } from "ohash";
import fsSync from "fs";
import fs from "fs/promises";
import { detect } from "package-manager-detector";
import { getPackageManifest, type PackageManifest } from "query-registry";
import {
  abbreviateCommitHash,
  extractOwnerAndRepo,
  extractRepository,
} from "@pkg-pr-new/utils";
import { glob } from "tinyglobby";
import ignore from "ignore";
import "./environments";
import { isBinaryFile } from "isbinaryfile";
import { readPackageJSON, writePackageJSON } from "pkg-types";
import { createDefaultTemplate } from "./template";
import type { Comment } from "@pkg-pr-new/utils";


declare global {
  var API_URL: string;
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

type Options = {
  comment: Comment;
  compact?: boolean;
  pnpm?: boolean;
  peerDeps?: boolean;
  onlyTemplates?: boolean;
  json?: boolean | string;
  noDefaultTemplate?: boolean;
};

const apiUrl = process.env.API_URL ?? API_URL;
const publishUrl = new URL("/publish", apiUrl);

export async function preview(
  packages: string[],
  templates: string[],
  options: Options,
) {
  const formData = new FormData();

  if (!process.env.TEST && process.env.GITHUB_ACTIONS !== "true") {
    console.error("Continuous Releases are only available in Github Actions.");
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
    console.error(await checkResponse.text());
    process.exit(1);
  }

  const { sha } = await checkResponse.json();
  const abbreviatedSha = abbreviateCommitHash(sha);

  const deps: Map<string, string> = new Map(); // pkg.pr.new versions of the package
  const realDeps: Map<string, string> | null = options.peerDeps
    ? new Map()
    : null; // real versions of the package, useful for peerDependencies

  const printJson = typeof options.json === "boolean";
  const saveJson = typeof options.json === "string";
  const jsonFilePath = saveJson ? options.json as string : "";
  const outputMetadata: OutputMetadata = {
    packages: [],
    templates: [],
  };

  for (const p of packages) {
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

    if (options.compact) {
      await verifyCompactMode(pJson.name);
    }

    const depUrl = new URL(
      `/${owner}/${repo}/${pJson.name}@${abbreviatedSha}`,
      apiUrl,
    ).href;
    deps.set(pJson.name, depUrl);
    realDeps?.set(pJson.name, pJson.version ?? depUrl);

    const resource = await fetch(depUrl);
    if (resource.ok) {
      console.warn(
        `${pJson.name}@${abbreviatedSha} was already published on ${depUrl}`,
      );
    }

    // Collect package metadata
    outputMetadata.packages.push({
      name: pJson.name,
      url: depUrl,
      shasum: "", // will be filled later
    });
  }

  for (const templateDir of templates) {
    if (!(await hasPackageJson(templateDir))) {
      console.warn(
        `skipping ${templateDir} because there's no package.json file`,
      );
      continue;
    }
    const pJsonPath = path.resolve(templateDir, "package.json");
    const pJson = await readPackageJSON(pJsonPath);

    if (!pJson.name) {
      throw new Error(`"name" field in ${pJsonPath} should be defined`);
    }

    console.warn("preparing template:", pJson.name);

    const restore = await writeDeps(templateDir, deps, realDeps);

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

  if (!options.noDefaultTemplate) {
    const project = createDefaultTemplate(Object.fromEntries(deps.entries()));

    for (const filePath of Object.keys(project)) {
      formData.append(
        `template:default:${encodeURIComponent(filePath)}`,
        project[filePath],
      );
    }
  }

  const restoreMap = new Map<string, Awaited<ReturnType<typeof writeDeps>>>();
  for (const p of packages) {
    if (!(await hasPackageJson(p))) {
      continue;
    }
    const pJsonPath = path.resolve(p, "package.json");
    const pJson = await readPackageJSON(pJsonPath);

    if (pJson.private) {
      continue;
    }

    restoreMap.set(p, await writeDeps(p, deps, realDeps));
  }

  const shasums: Record<string, string> = {};
  for (const p of packages) {
    if (!(await hasPackageJson(p))) {
      console.warn(`skipping ${p} because there's no package.json file`);
      continue;
    }
    const pJsonPath = path.resolve(p, "package.json");
    try {
      const pJson = await readPackageJSON(pJsonPath);

      if (!pJson.name) {
        throw new Error(`"name" field in ${pJsonPath} should be defined`);
      }
      if (pJson.private) {
        console.warn(`skipping ${p} because the package is private`);
        continue;
      }

      const { filename, shasum } = await resolveTarball(
        options.pnpm ? "pnpm" : "npm",
        p,
      );

      shasums[pJson.name] = shasum;
      console.warn(`shasum for ${pJson.name}(${filename}): ${shasum}`);

      const outputPkg = outputMetadata.packages.find(
        (p) => p.name === pJson.name,
      )!;
      outputPkg.shasum = shasum;

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
      "sb-comment": options.comment,
      "sb-compact": `${options.compact}`,
      "sb-key": key,
      "sb-shasums": JSON.stringify(shasums),
      "sb-run-id": GITHUB_RUN_ID,
      "sb-package-manager": packageManager.agent ?? "npm",
      "sb-only-templates": `${options.onlyTemplates}`,
    },
    body: formData,
  });
  const laterRes = await res.clone().json();
  assert.equal(res.status, 200, `publishing failed: ${await res.text()}`);

  console.warn("\n");
  console.warn(
    `⚡️ Your npm packages are published.\n${[...formData.keys()]
      .filter((k) => k.startsWith("package:"))
      .map(
        (name, i) =>
          `${name.slice("package:".length)}: npm i ${laterRes.urls[i]}`,
      )
      .join("\n")}`,
  );

  const output = JSON.stringify(outputMetadata, null, 2);
  if (printJson) {
    console.log(output); // Log output for piping
  }
  if (saveJson) {
    await fs.writeFile(jsonFilePath, output);
    console.warn(`metadata written to ${jsonFilePath}`);
  }
}

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

async function writeDeps(
  p: string,
  deps: Map<string, string>,
  realDeps: Map<string, string> | null,
) {
  const pJsonPath = path.resolve(p, "package.json");
  const content = await fs.readFile(pJsonPath, "utf-8");

  const pJson = await readPackageJSON(pJsonPath);

  hijackDeps(deps, pJson.dependencies);
  hijackDeps(deps, pJson.devDependencies);
  hijackDeps(deps, pJson.optionalDependencies);

  if (realDeps) {
    hijackDeps(realDeps, pJson.peerDependencies);
  }

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
