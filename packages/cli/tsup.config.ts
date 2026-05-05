import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: "esm",
  platform: "node",
  target: "node18",
  minify: false,
  splitting: false,
  sourcemap: "inline",
  define: {
    API_URL: JSON.stringify(process.env.API_URL ?? "https://localhost:3000"),
  },
  clean: true,
  bundle: true,
  dts: false,
  banner: {
    js: `import { createRequire as __nodeRequire } from "node:module"; const require = __nodeRequire(import.meta.url);`,
  },
});
