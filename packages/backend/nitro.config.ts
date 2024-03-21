import { R2Bucket } from '@cloudflare/workers-types';
import ncb from 'nitro-cloudflare-dev'

declare module "nitro-cloudflare-dev" {
    interface Env {
      PKGS: R2Bucket
    }
}

declare module "nitropack" {
  interface NitroRuntimeConfig {
    appId: string
    webhookSecret: string
    privateKey: string
  }
}

// https://nitro.unjs.io/config
export default defineNitroConfig({
  preset: 'cloudflare-pages',
  modules: [ncb],
  srcDir: "server",

  runtimeConfig: {
    appId: "",
    webhookSecret: "",
    privateKey: ""
  }
});
