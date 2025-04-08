import esbuild from "esbuild";
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const octokitPath = require.resolve("octokit");

await esbuild.build({
  entryPoints: [octokitPath],
  bundle: true,
  format: "esm",
  sourcemap: "inline",
  platform: "browser",
  write: true,
  outfile: "vendor/octokit.build.mjs",
  plugins: [polyfillNode()],
});
