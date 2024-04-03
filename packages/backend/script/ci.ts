import fs from "fs/promises";
if (process.env.CI) {
  const content = Object.entries(process.env)
    .filter(([k]) => k.startsWith("NITRO"))
    .concat(['NITRO_TEST', "true"])
    .concat(['GITHUB_TOKEN', process.env.GITHUB_TOKEN!])
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  console.log(content)
  await fs.writeFile(".dev.vars", content);
}
