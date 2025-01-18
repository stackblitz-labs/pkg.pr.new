import { Octokit } from "octokit";
import { config } from "dotenv";
import { createSigner } from "fast-jwt";

config({ path: ".dev.vars" });

const nitroSigner = createSigner({
  algorithm: "RS256",
  key: process.env.NITRO_PRIVATE_KEY!,
});

function generateJWT() {
  const payload = {
    iat: Math.floor(Date.now() / 1000), // Issued at time
    exp: Math.floor(Date.now() / 1000) + 15, // JWT expiration time (15 secs)
    iss: process.env.NITRO_APP_ID!, // Issuer (GitHub App ID)
  };

  return nitroSigner(payload);
}

// Generate JWT
const jwtToken = generateJWT();

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
