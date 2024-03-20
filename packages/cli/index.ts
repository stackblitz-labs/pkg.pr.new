import { defineCommand, runMain } from "citty";
// import { createRequire } from "module";
import { version } from "./package.json";
import { Octokit } from "@octokit/action";
import "./environments";

if (process.env.GITHUB_ACTIONS !== 'true') {
  console.error('Stackblitz Continuous Releases are only available in Github Actions.')
  process.exit(1)
}

const octokit = new Octokit();
const eventPayload = await import(process.env.GITHUB_EVENT_PATH, {
  with: { type: "json" },
});

console.log(process.env)
// console.log(octokit)
// console.log(eventPayload)

const main = defineCommand({
  meta: {
    version,
    name: "stackblitz",
    description: "A CLI for stackblitz CR (Continuous Releases)",
  },
  subCommands: {
    publish: () => {
      return {
        meta: {},
        run: () => {},
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

runMain(main);
