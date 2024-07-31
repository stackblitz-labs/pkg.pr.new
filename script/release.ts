import { release } from "@vitejs/release-scripts";

release({
  repo: "pkg.pr.new",
  packages: ["cli"],
  toTag: (_, version) => `v${version}`,
  logChangelog: () => {},
  generateChangelog: async () => {},
});
