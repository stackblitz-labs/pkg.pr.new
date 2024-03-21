import {fileURLToPath} from 'url'
import { DurableObject, R2Bucket } from '@cloudflare/workers-types';
import ncb from 'nitro-cloudflare-dev'

declare module "nitro-cloudflare-dev" {
    interface Env {
      PKGS: R2Bucket
      WORKFLOWS: DurableObject
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
  entry: fileURLToPath(new URL('./preset/entry.ts', import.meta.url)),

  runtimeConfig: {
    appId: "",
    webhookSecret: "",
    privateKey: ""
  }
});
