import { R2Bucket } from "@cloudflare/workers-types";
import ncb from "nitro-cloudflare-dev";

declare module "nitro-cloudflare-dev" {
  interface Env {
    ENV: "production" | "staging";
    PROD_CR_BUCKET: R2Bucket;
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
  runtimeConfig: {
    appId: "",
    ghBaseUrl: "https://api.github.com",
    webhookSecret: "",
    privateKey: "",
    rmStaleKey: "",
    test: "",
  },
  timing: true,
});
