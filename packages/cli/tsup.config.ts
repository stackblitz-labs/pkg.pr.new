import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: "esm",
  minify: false,
  splitting: false,
  sourcemap: "inline",
  clean: true,
  bundle: true,
  dts: false,
});
