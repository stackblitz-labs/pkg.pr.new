import { KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import ncb from 'nitro-cloudflare-dev'

declare module "nitro-cloudflare-dev" {
    interface Env {
      PKGS: R2Bucket
      WORKFLOWS: KVNamespace
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
  storage: {
    'workflows': {
      driver: 'cloudflare-kv-binding',
      base: 'workflows',
      binding: 'WORKFLOWS'
    },
  },
  devStorage: {
    'workflows': {
      driver: 'cloudflare-kv-binding',
      base: 'workflows',
      binding: 'WORKFLOWS'
    }
  },

  runtimeConfig: {
    appId: "",
    webhookSecret: "",
    privateKey: ""
  }
});
