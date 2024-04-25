// import { Octokit } from "";
import { Octokit } from "@octokit/action";

const octokit = new Octokit();

let {
  data: { url },
} = await octokit.request("GET /app/hook/config");

console.log(`current webhook url: ${url}`);

await octokit.request("PATCH /app/hook/config", {
  url: "https://example.com/webhook",
});

({ url } = await octokit.request("GET /app/hook/config"));

console.log(`webhook url is ${url} now!`);
