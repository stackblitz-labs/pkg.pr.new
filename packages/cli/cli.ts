import { defineCommand, runMain } from "citty";
import assert from "node:assert";
import path from "path";
import ezSpawn from "@jsdevtools/ez-spawn";
import { createHash } from "node:crypto";
import { hash } from "ohash";
import fsSync from "fs";
import fs from "fs/promises";
import { detect } from "package-manager-detector";
import { getPackageManifest, type PackageManifest } from "query-registry";
import type { Comment } from "@pkg-pr-new/utils";
import {
  abbreviateCommitHash,
  extractOwnerAndRepo,
  extractRepository,
} from "@pkg-pr-new/utils";
import { glob } from "tinyglobby";
import ignore from "ignore";
import "./environments";
import pkg from "./package.json" with { type: "json" };
import { isBinaryFile } from "isbinaryfile";
import { readPackageJSON, writePackageJSON } from "pkg-types";
import { createDefaultTemplate } from "./template";
import { preview } from ".";

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
          "only-templates": {
            type: "boolean",
            description: `generate only stackblitz templates`,
            default: false,
          },
          json: {
            type: "mixed",
            description: `Save metadata to a JSON file. If true, log the output for piping. If a string, save the output to the specified file path.`,
          },
        },
        run: async ({ args }) => {
          const paths = args._.length
            ? await glob(args._, {
                expandDirectories: false,
                onlyDirectories: true,
                absolute: true,
              })
            : [process.cwd()];

          if (args._.includes(".") || args._.includes("./")) {
            paths.push(process.cwd());
          }

          const templatePatterns =
            typeof args.template === "string"
              ? [args.template]
              : ([...(args.template || [])] as string[]);

          const templates = await glob(templatePatterns, {
            expandDirectories: false,
            onlyDirectories: true,
            absolute: true,
          });

          if (
            templatePatterns.includes(".") ||
            templatePatterns.includes("./")
          ) {
            templates.push(process.cwd());
          }

          await preview(paths, templates, {
            comment: args.comment,
            compact: !!args.compact,
            pnpm: !!args.pnpm,
            peerDeps: !!args.peerDeps,
            json: args.json,
            noDefaultTemplate: args.template === false,
            onlyTemplates: !!args.onlyTemplates,
          })
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

runMain(main)
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

