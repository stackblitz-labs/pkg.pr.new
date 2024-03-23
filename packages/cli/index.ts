import { defineCommand, runMain } from "citty";
// import { createRequire } from "module";
import { version } from "./package.json";
import {objectHash, sha256} from 'ohash'
import { Octokit } from "@octokit/action";
import "./environments";

declare global {
  var API_URL: string
}

const publishUrl = new URL('/publish', API_URL)

if (process.env.GITHUB_ACTIONS !== 'true') {
  console.error('Stackblitz Continuous Releases are only available in Github Actions.')
  process.exit(1)
}

const {GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_ACTOR_ID} = process.env
// const octokit = new Octokit();
// const eventPayload = await import(process.env.GITHUB_EVENT_PATH, {
//   with: { type: "json" },
// });
console.log(process.env)

// Note: If you need to use a workflow run's URL from within a job, you can combine these variables: $GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID
const url = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`

const metadata = {
  url,
  attempt: GITHUB_RUN_ATTEMPT,
  actor: GITHUB_ACTOR_ID
}

const key = sha256(objectHash(metadata))



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
        run: async () => {
          await fetch(publishUrl,{
            method: "POST",
            headers: {
             'sb-key': key 
            },
            body: new ReadableStream({
              start(c) {
                c.enqueue(new Uint8Array([1,2,3]))
                c.close()
              }
            })
          })
        },
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
