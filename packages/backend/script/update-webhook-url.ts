import { App } from "octokit";

const { octokit } = new App({
  appId: process.env.NITRO_APP_ID!,
  privateKey: process.env.NITRO_PRIVATE_KEY!
});

let { url } = await octokit.request("GET /app/hook/config");

console.log(`current webhook url: ${url}`);

await octokit.request("PATCH /app/hook/config", {
  url: "https://example.com/webhook",
});


({ url } = await octokit.request("GET /app/hook/config"));

console.log(`webhook url is ${url} now!`);
