import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts", "cli.ts"],
  format: "esm",
  minify: false,
  splitting: false,
  sourcemap: "inline",
  define: {
    API_URL: JSON.stringify(process.env.API_URL ?? "https://localhost:3000"),
  },
  clean: true,
  bundle: true,
  dts: false,
});
