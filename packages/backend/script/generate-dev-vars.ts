import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

async function generateDevVars() {
  const filePath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "../.dev.vars",
  );

  // Try to read existing vars
  let existingVars: Record<string, string> = {};
  try {
    const content = await fs.readFile(filePath, "utf-8");
    existingVars = Object.fromEntries(
      content
        .split("\n")
        .map((line) => line.split("="))
        .map(([key, ...values]) => [key, values.join("=")])
        .filter(([key]) => key),
    );
  } catch (error) {
    // File doesn't exist, continue with empty vars
  }

  // Only generate missing values
  const updates: Record<string, string> = {
    NITRO_TEST: existingVars.NITRO_TEST || "true",
    NITRO_WEBHOOK_SECRET:
      existingVars.NITRO_WEBHOOK_SECRET ||
      crypto.randomBytes(16).toString("hex"),
    NITRO_APP_ID: existingVars.NITRO_APP_ID || "859925",
    NITRO_GH_BASE_URL:
      existingVars.NITRO_GH_BASE_URL || "http://localhost:3300",
    NITRO_RM_STALE_KEY:
      existingVars.NITRO_RM_STALE_KEY || crypto.randomBytes(32).toString("hex"),
  };

  // Only generate private key if missing
  if (!existingVars.NITRO_PRIVATE_KEY) {
    const { privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    });
    updates.NITRO_PRIVATE_KEY = privateKey;
  } else {
    updates.NITRO_PRIVATE_KEY = existingVars.NITRO_PRIVATE_KEY;
  }

  // Create the content with all vars
  const envContent = Object.entries(updates)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Write to .dev.vars file
  await fs.writeFile(filePath, envContent, "utf-8");

  console.log("Updated .dev.vars file successfully!");
}

generateDevVars().catch(console.error);
