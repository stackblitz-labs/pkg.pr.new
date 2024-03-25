import { R2Bucket } from "@cloudflare/workers-types";
import ncb from "nitro-cloudflare-dev";

declare module "nitro-cloudflare-dev" {
  interface Env {
    BUCKET: R2Bucket;
  }
}

declare module "nitropack" {
  interface NitroRuntimeConfig {
    appId: string;
    webhookSecret: string;
    privateKey: string;
    test: "" | true;
  }
}

const storage = {
  bucket: {
    driver: "cloudflareR2Binding",
    base: "bucket",
    binding: "BUCKET",
  },
};

// https://nitro.unjs.io/config
export default defineNitroConfig({
  sourceMap: 'inline',
  preset: "cloudflare-pages",
  modules: [ncb],
  srcDir: "server",
  storage,
  devStorage: storage,
  runtimeConfig: {
    appId: "",
    webhookSecret: "",
    privateKey: "",
    test: "",
  },
});
