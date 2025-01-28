import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { polyfillNode } from "esbuild-plugin-polyfill-node";

await esbuild.build({
  entryPoints: [fileURLToPath(import.meta.resolve("octokit/dist-web"))],
  bundle: true,
  format: "esm",
  sourcemap: "inline",
  platform: "browser",
  write: true,
  outfile: "vendor/octokit.build.mjs",
  plugins: [polyfillNode()],
});
