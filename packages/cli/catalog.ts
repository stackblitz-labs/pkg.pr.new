import fs from "node:fs";
import path from "node:path";
import readYamlFile from "read-yaml-file";
import { PackageJson } from "pkg-types";

interface PnpmWorkspaceYaml {
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

// https://github.com/pnpm/rfcs/blob/main/text/0001-catalogs.md
export function createResolver(rootYaml: PnpmWorkspaceYaml) {
  const catalog = rootYaml.catalog ?? {};
  const catalogs = rootYaml.catalogs ?? {};

  function resolveVersion(name: string, version: string) {
    if (!version.startsWith("catalog:")) {
      return version;
    }

    const useCatalog = version.slice("catalog:".length).trim();
    if (useCatalog.length === 0 || useCatalog === "default") {
      const catalogVersion = catalog[name];
      if (!catalogVersion) {
        throw new Error(`Missing pnpm catalog version for ${name}`);
      }
      return catalogVersion;
    }

    const catalogVersion = catalogs[useCatalog]?.[name];
    if (!catalogVersion) {
      throw new Error(
        `Missing pnpm catalog version for ${name} in catalogs.${useCatalog}`,
      );
    }
    return catalogVersion;
  }

  function resolveCatalogVersions(pJson: PackageJson) {
    // TODO: should we also include overrides, resolutions, and pnpm.overrides?
    for (const depObjKey of [
      "dependencies",
      "devDependencies",
      "peerDependencies",
    ]) {
      const depObj = pJson[depObjKey];
      if (!depObj) {
        continue;
      }
      for (const depName of Object.keys(depObj)) {
        depObj[depName] = resolveVersion(depName, depObj[depName]);
      }
    }
  }

  return resolveCatalogVersions;
}

export async function loadCatalogs(root = process.cwd()) {
  const pnpmWorkspace = path.resolve(root, "pnpm-workspace.yaml");
  if (!fs.existsSync(pnpmWorkspace)) {
    return undefined;
  }

  return createResolver(await readYamlFile(pnpmWorkspace));
}
