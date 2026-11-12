import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  const writeIncludedFile = async (rel: string, contents: string) => {
    const filePath = path.join(workspaceDir, rel);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, contents);
  };

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

  it("resolves catalogs from files included through include", async () => {
    await writeWorkspace(
      [
        "include:",
        "  ./config/catalog.yaml: [catalog]",
        "  ./config/named.yaml: [catalogs.react18, catalogs.tooling]",
        "",
      ].join("\n"),
    );
    await writeIncludedFile(
      "config/catalog.yaml",
      "catalog:\n  vite: ^6.0.0\n",
    );
    await writeIncludedFile(
      "config/named.yaml",
      [
        "catalogs:",
        "  react18:",
        "    react: ^18.3.1",
        "  tooling:",
        "    typescript: ~5.7.0",
        "",
      ].join("\n"),
    );
    const pJson: PackageJson = {
      dependencies: { vite: "catalog:" },
      devDependencies: {
        react: "catalog:react18",
        typescript: "catalog:tooling",
      },
    };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual({ vite: "^6.0.0" });
    expect(pJson.devDependencies).toEqual({
      react: "^18.3.1",
      typescript: "~5.7.0",
    });
  });

  it("resolves catalogs from a '*' delegated file", async () => {
    await writeWorkspace("include:\n  ./config/all.yaml: '*'\n");
    await writeIncludedFile(
      "config/all.yaml",
      [
        "catalog:",
        "  vite: ^6.0.0",
        "catalogs:",
        "  vue:",
        "    vue: ^3.5.0",
        "",
      ].join("\n"),
    );
    const pJson: PackageJson = {
      dependencies: { vite: "catalog:", vue: "catalog:vue" },
    };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual({ vite: "^6.0.0", vue: "^3.5.0" });
  });

  it("resolves every catalog from a [catalogs] delegated file", async () => {
    await writeWorkspace("include:\n  ./config/all.yaml: [catalogs]\n");
    await writeIncludedFile(
      "config/all.yaml",
      [
        "catalog:",
        "  vite: ^6.0.0",
        "catalogs:",
        "  react18:",
        "    react: ^18.3.1",
        "",
      ].join("\n"),
    );
    const pJson: PackageJson = {
      dependencies: { vite: "catalog:", react: "catalog:react18" },
    };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual({ vite: "^6.0.0", react: "^18.3.1" });
  });

  it("combines root catalogs with included catalogs", async () => {
    await writeWorkspace(
      [
        "catalog:",
        "  vite: ^6.0.0",
        "include:",
        "  ./config/named.yaml: [catalogs.react18]",
        "",
      ].join("\n"),
    );
    await writeIncludedFile(
      "config/named.yaml",
      "catalogs:\n  react18:\n    react: ^18.3.1\n",
    );
    const pJson: PackageJson = {
      dependencies: { vite: "catalog:", react: "catalog:react18" },
    };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual({ vite: "^6.0.0", react: "^18.3.1" });
  });

  it("ignores catalogs a file is not delegated", async () => {
    await writeWorkspace("include:\n  ./config/one.yaml: [catalogs.react18]\n");
    await writeIncludedFile(
      "config/one.yaml",
      [
        "catalogs:",
        "  react18:",
        "    react: ^18.3.1",
        "  vue:",
        "    vue: ^3.5.0",
        "",
      ].join("\n"),
    );
    const pJson: PackageJson = {
      dependencies: { react: "catalog:react18", vue: "catalog:vue" },
    };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual({
      react: "^18.3.1",
      vue: "catalog:vue",
    });
  });

  it("warns and leaves catalog: unresolved when owned by a config dependency", async () => {
    await writeWorkspace("include:\n  '@acme/pnpm-policy': [catalog]\n");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pJson: PackageJson = { dependencies: { vite: "catalog:" } };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual({ vite: "catalog:" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("@acme/pnpm-policy"),
    );

    warn.mockRestore();
  });

  it("does not warn about config dependencies without catalog usage", async () => {
    await writeWorkspace(
      "include:\n  '@acme/pnpm-policy': [minimumReleaseAge]\n",
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pJson: PackageJson = { dependencies: { vite: "^6.0.0" } };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual({ vite: "^6.0.0" });
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it("warns and continues when an included file cannot be read", async () => {
    await writeWorkspace("include:\n  ./config/missing.yaml: [catalog]\n");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const pJson: PackageJson = { dependencies: { vite: "catalog:" } };

    await resolveCatalogs(templateDir, pJson);

    expect(pJson.dependencies).toEqual({ vite: "catalog:" });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("./config/missing.yaml"),
    );

    warn.mockRestore();
  });
});
