import fs from "node:fs/promises";
import path from "node:path";
import { parseYAML } from "confbox";
import { findNearestFile, type PackageJson } from "pkg-types";

type Catalog = Record<string, string>;
type Catalogs = Record<string, Catalog | undefined>;
type IncludeSettings = "*" | string[] | undefined;

interface PnpmWorkspace {
  catalog?: Catalog;
  catalogs?: Catalogs;
  include?: Record<string, IncludeSettings>;
}

const CATALOG_PROTOCOL = "catalog:";

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export async function resolveCatalogs(dir: string, pJson: PackageJson) {
  const { catalogs, configDependencyOwners } = await readCatalogs(dir);
  if (!catalogs) {
    return;
  }
  let hasUnresolvedSpec = false;
  for (const field of dependencyFields) {
    const deps = pJson[field];
    if (!deps) {
      continue;
    }
    for (const [name, spec] of Object.entries(deps)) {
      const version = resolveCatalogSpec(catalogs, name, spec);
      if (version) {
        deps[name] = version;
      } else if (spec.startsWith(CATALOG_PROTOCOL)) {
        hasUnresolvedSpec = true;
      }
    }
  }
  if (hasUnresolvedSpec && configDependencyOwners.length > 0) {
    console.warn(
      `pkg-pr-new: cannot resolve 'catalog:' dependencies whose catalog is owned by the config dependenc${configDependencyOwners.length > 1 ? "ies" : "y"} ${configDependencyOwners.map((owner) => `'${owner}'`).join(", ")}. They are left as-is.`,
    );
  }
}

async function readCatalogs(dir: string): Promise<{
  catalogs: Catalogs | null;
  configDependencyOwners: string[];
}> {
  const workspacePath = await findNearestFile("pnpm-workspace.yaml", {
    startingFrom: dir,
  }).catch(() => null);
  if (!workspacePath) {
    return { catalogs: null, configDependencyOwners: [] };
  }
  const workspaceRoot = path.dirname(workspacePath);
  const workspace =
    parseYAML<PnpmWorkspace | null>(await fs.readFile(workspacePath, "utf8")) ??
    {};
  const catalogs: Catalogs = {
    ...workspace.catalogs,
    default: workspace.catalog ?? workspace.catalogs?.default,
  };
  const configDependencyOwners = await mergeIncludedCatalogs(
    workspace,
    workspaceRoot,
    catalogs,
  );
  return { catalogs, configDependencyOwners };
}

// pnpm-workspace.yaml can delegate settings to other files through `include`
// (https://pnpm.io/config-includes), so catalogs may live outside the root
// workspace file. Each catalog has exactly one owner, so merge only what each
// source is delegated. `include` itself is never valid inside an included
// file, hence no recursion.
async function mergeIncludedCatalogs(
  workspace: PnpmWorkspace,
  workspaceRoot: string,
  catalogs: Catalogs,
): Promise<string[]> {
  const configDependencyOwners: string[] = [];
  for (const [source, settings] of Object.entries(workspace.include ?? {})) {
    if (!ownsCatalogSettings(settings)) {
      continue;
    }
    if (!source.startsWith("./") && !source.startsWith("../")) {
      configDependencyOwners.push(source);
      continue;
    }
    const included = await readIncludedWorkspace(source, workspaceRoot);
    if (!included) {
      continue;
    }
    for (const [name, catalog] of Object.entries(
      extractDelegatedCatalogs(included, settings),
    )) {
      if (!catalogs[name]) {
        catalogs[name] = catalog;
      }
    }
  }
  return configDependencyOwners;
}

async function readIncludedWorkspace(
  source: string,
  workspaceRoot: string,
): Promise<PnpmWorkspace | null> {
  try {
    const contents = await fs.readFile(
      path.resolve(workspaceRoot, source),
      "utf8",
    );
    return parseYAML<PnpmWorkspace | null>(contents) ?? {};
  } catch (error) {
    console.warn(
      `pkg-pr-new: failed to read '${source}', included from ${path.join(workspaceRoot, "pnpm-workspace.yaml")}, while resolving catalogs: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function ownsCatalogSettings(settings: IncludeSettings) {
  return (
    settings === "*" ||
    !!settings?.some(
      (setting) =>
        setting === "catalog" ||
        setting === "catalogs" ||
        setting.startsWith("catalogs."),
    )
  );
}

function extractDelegatedCatalogs(
  workspace: PnpmWorkspace,
  settings: IncludeSettings,
): Catalogs {
  const extracted: Catalogs = {};
  const defaultCatalog = workspace.catalog ?? workspace.catalogs?.default;
  if (
    defaultCatalog &&
    (settings === "*" ||
      settings?.includes("catalog") ||
      settings?.includes("catalogs.default") ||
      settings?.includes("catalogs"))
  ) {
    extracted.default = defaultCatalog;
  }
  for (const [name, catalog] of Object.entries(workspace.catalogs ?? {})) {
    if (
      name !== "default" &&
      catalog &&
      (settings === "*" ||
        settings?.includes("catalogs") ||
        settings?.includes(`catalogs.${name}`))
    ) {
      extracted[name] = catalog;
    }
  }
  return extracted;
}

function resolveCatalogSpec(catalogs: Catalogs, name: string, spec: string) {
  if (!spec.startsWith(CATALOG_PROTOCOL)) {
    return;
  }
  const catalogName = spec.slice(CATALOG_PROTOCOL.length).trim() || "default";
  return catalogs[catalogName]?.[name];
}
