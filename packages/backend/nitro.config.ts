import { R2Bucket } from '@cloudflare/workers-types';
import ncb from 'nitro-cloudflare-dev'

declare module "nitro-cloudflare-dev" {
    interface Env {
      PKGS: R2Bucket
    }
}

// https://nitro.unjs.io/config
export default defineNitroConfig({
  modules: [ncb],
  srcDir: "server",
});
