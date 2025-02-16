import path from "path";
import { defineConfig } from "vitest/config";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const simulacrumFoundationSimulator = path.resolve(
  __dirname,
  "node_modules/@simulacrum/foundation-simulator/dist/cjs/index.js",
);

export default defineConfig({
  resolve: {
    alias: {
      "@simulacrum/foundation-simulator": simulacrumFoundationSimulator,
    },
  },
  test: {},
});
