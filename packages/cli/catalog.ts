import fs from "node:fs/promises";
import { parseYAML } from "confbox";
import { findNearestFile, type PackageJson } from "pkg-types";

type Catalog = Record<string, string>;
type Catalogs = Record<string, Catalog | undefined>;

interface PnpmWorkspace {
  catalog?: Catalog;
  catalogs?: Catalogs;
}

const CATALOG_PROTOCOL = "catalog:";

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export async function resolveCatalogs(dir: string, pJson: PackageJson) {
  const catalogs = await readCatalogs(dir);
  if (!catalogs) {
    return;
  }
  for (const field of dependencyFields) {
    const deps = pJson[field];
    if (!deps) {
      continue;
    }
    for (const [name, spec] of Object.entries(deps)) {
      const version = resolveCatalogSpec(catalogs, name, spec);
      if (version) {
        deps[name] = version;
      }
    }
  }
}

async function readCatalogs(dir: string): Promise<Catalogs | null> {
  const workspacePath = await findNearestFile("pnpm-workspace.yaml", {
    startingFrom: dir,
  }).catch(() => null);
  if (!workspacePath) {
    return null;
  }
  const { catalog, catalogs } =
    parseYAML<PnpmWorkspace | null>(await fs.readFile(workspacePath, "utf8")) ??
    {};
  return { ...catalogs, default: catalog ?? catalogs?.default };
}

function resolveCatalogSpec(catalogs: Catalogs, name: string, spec: string) {
  if (!spec.startsWith(CATALOG_PROTOCOL)) {
    return;
  }
  const catalogName = spec.slice(CATALOG_PROTOCOL.length).trim() || "default";
  return catalogs[catalogName]?.[name];
}
