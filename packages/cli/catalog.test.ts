import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PackageJson } from "pkg-types";
import { resolveCatalogs } from "./catalog";

describe("resolveCatalogs", () => {
  let workspaceDir: string;
  let templateDir: string;

  beforeEach(async () => {
    workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "pkg-pr-new-"));
    templateDir = path.join(workspaceDir, "templates", "example");
    await fs.mkdir(templateDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(workspaceDir, { recursive: true, force: true });
  });

  const writeWorkspace = (contents: string) =>
    fs.writeFile(path.join(workspaceDir, "pnpm-workspace.yaml"), contents);

  it("resolves the default catalog", async () => {
    await writeWorkspace("catalog:\n  vite: ^6.0.0\n");
    const pJson: PackageJson = { devDependencies: { vite: "catalog:" } };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.devDependencies).toEqual({ vite: "^6.0.0" });
  });

  it("resolves catalog:default from catalogs.default", async () => {
    await writeWorkspace("catalogs:\n  default:\n    vite: ^6.0.0\n");
    const pJson: PackageJson = {
      dependencies: { vite: "catalog:default" },
      devDependencies: { vite: "catalog:" },
    };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual({ vite: "^6.0.0" });
    expect(pJson.devDependencies).toEqual({ vite: "^6.0.0" });
  });

  it("resolves named catalogs in every dependency field", async () => {
    await writeWorkspace(
      [
        "catalog:",
        "  vue: ^3.5.0",
        "catalogs:",
        "  react18:",
        "    react: ^18.3.1",
        "    react-dom: ^18.3.1",
        "  tooling:",
        "    typescript: ~5.7.0",
        "",
      ].join("\n"),
    );
    const pJson: PackageJson = {
      dependencies: { react: "catalog:react18", vue: "catalog:" },
      devDependencies: { typescript: "catalog:tooling" },
      peerDependencies: { "react-dom": "catalog:react18" },
      optionalDependencies: { vue: "catalog:" },
    };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson).toEqual({
      dependencies: { react: "^18.3.1", vue: "^3.5.0" },
      devDependencies: { typescript: "~5.7.0" },
      peerDependencies: { "react-dom": "^18.3.1" },
      optionalDependencies: { vue: "^3.5.0" },
    });
  });

  it("keeps specifiers that are not resolvable from a catalog", async () => {
    await writeWorkspace("catalog:\n  vite: ^6.0.0\n");
    const dependencies = {
      vue: "catalog:",
      react: "catalog:missing",
      lodash: "^4.17.21",
      "my-lib": "workspace:*",
    };
    const pJson: PackageJson = { dependencies: { ...dependencies } };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual(dependencies);
  });

  it("does nothing without a pnpm workspace", async () => {
    const pJson: PackageJson = { devDependencies: { vite: "catalog:" } };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.devDependencies).toEqual({ vite: "catalog:" });
  });
});
