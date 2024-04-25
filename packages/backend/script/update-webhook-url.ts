import { App } from "octokit";

const { octokit, getInstallationOctokit } = new App({
  appId: process.env.NITRO_APP_ID!,
  privateKey: process.env.NITRO_PRIVATE_KEY!,
});

const { data: installationData } = await octokit.request(
  "GET /repos/{owner}/{repo}/installation",
  {
    owner: "stackblitz-labs",
    repo: "pkg.pr.new",
  },
);

const installation = await getInstallationOctokit(installationData.id);

let {
  data: { url },
} = await installation.request("GET /app/hook/config");

console.log(`current webhook url: ${url}`);

await installation.request("PATCH /app/hook/config", {
  url: "https://example.com/webhook",
});

({ url } = await installation.request("GET /app/hook/config"));

console.log(`webhook url is ${url} now!`);
