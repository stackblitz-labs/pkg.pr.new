import { R2Bucket } from "@cloudflare/workers-types";
import ncb from "nitro-cloudflare-dev";

declare module "nitro-cloudflare-dev" {
  interface Env {
    ENV: "production" | "staging"
    CR_BUCKET: R2Bucket;
  }
}

declare module "nitropack" {
  interface NitroRuntimeConfig {
    appId: string;
    webhookSecret: string;
    privateKey: string;
    rmStaleKey: string;
    test: "" | true;
  }
}

// https://nitro.unjs.io/config
export default defineNitroConfig({
  sourceMap: "inline",
  preset: "cloudflare-pages",
  modules: [ncb],
  srcDir: "server",
  experimental: {
    tasks: true,
  },
  scheduledTasks: {
    '0 15 1 * *': ['rm:stale']
  },
  runtimeConfig: {
    appId: "",
    webhookSecret: "",
    privateKey: "",
    rmStaleKey: "",
    test: "",
  },
  timing: true,
});
