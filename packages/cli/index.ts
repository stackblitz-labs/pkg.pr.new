import { defineCommand, runMain } from "citty";
// import { createRequire } from "module";
import { version } from "./package.json";
import {objectHash} from 'ohash'
import { Octokit } from "@octokit/action";
import "./environments";

if (process.env.GITHUB_ACTIONS !== 'true') {
  console.error('Stackblitz Continuous Releases are only available in Github Actions.')
  process.exit(1)
}

const {GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_ACTOR_ID} = process.env
// const octokit = new Octokit();
// const eventPayload = await import(process.env.GITHUB_EVENT_PATH, {
//   with: { type: "json" },
// });

// Note: If you need to use a workflow run's URL from within a job, you can combine these variables: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID
const url = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`

const token = {
  url,
  attempt: GITHUB_RUN_ATTEMPT,
  actor: GITHUB_ACTOR_ID
}

const hashedToken = objectHash(token) 

console.log(hashedToken)

// console.log(octokit)
// console.log(eventPayload)

const main = defineCommand({
  meta: {
    version,
    name: "stackblitz",
    description: "A CLI for Stackblitz CR (Continuous Releases)",
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
