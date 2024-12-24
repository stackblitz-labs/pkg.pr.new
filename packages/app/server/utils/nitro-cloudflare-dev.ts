import type { R2Bucket } from '@cloudflare/workers-types'
import 'nitro-cloudflare-dev'

declare module 'nitro-cloudflare-dev' {
  interface Env {
    ENV: 'production' | 'staging'
    PROD_CR_BUCKET: R2Bucket
    CR_BUCKET: R2Bucket
  }
}

export {}
