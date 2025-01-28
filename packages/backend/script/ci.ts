import fs from "node:fs/promises";
if (process.env.CI) {
  const content = [...Object.entries(process.env)
    .filter(([k]) => k.startsWith("NITRO"))
    .map(([k, v]) => `${k}="${v}"`), "NITRO_TEST=true", "GITHUB_TOKEN=" + process.env.GITHUB_TOKEN!]
    .join("\n");
  await fs.writeFile(".dev.vars", content);
}
