// import { Octokit } from "";
import { createTokenAuth } from "@octokit/auth-token";
import { Octokit, App } from "octokit";
import { config } from "dotenv";
import jwt from "jsonwebtoken";

config({ path: ".dev.vars" });

function generateJWT() {
  const payload = {
    iat: Math.floor(Date.now() / 1000), // Issued at time
    exp: Math.floor(Date.now() / 1000) + 15, // JWT expiration time (15 secs)
    iss: process.env.NITRO_APP_ID!, // Issuer (GitHub App ID)
  };

  return jwt.sign(payload, process.env.NITRO_PRIVATE_KEY!, {
    algorithm: "RS256",
  });
}

// Generate JWT
const jwtToken = generateJWT();
console.log(jwtToken);

// console.log("token", createTokenAuth(process.env.GITHUB_TOKEN!)());
// const { octokit } = new App({
//   appId: process.env.NITRO_APP_ID,
//   p
// });
const octokit = new Octokit({
  auth: jwtToken,
});

let {
  data: { url },
} = await octokit.request("GET /app/hook/config");

console.log(`current webhook url: ${url}`);

const newUrl = new URL(
  "/webhook",
  process.env.API_URL ?? "https://stackblitz-cr.pages.dev/",
);

const result = await octokit.request({
  method: "PATCH",
  url: "/app/hook/config",
  data: { url: newUrl.href },
});

console.log(`webhook url is ${result.data.url} now!`);
