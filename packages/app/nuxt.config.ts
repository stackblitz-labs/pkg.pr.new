import ncb from 'nitro-cloudflare-dev'
import { resolve } from 'pathe'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-07-30',

  // https://nuxt.com/docs/getting-started/upgrade#testing-nuxt-4
  future: { compatibilityVersion: 4 },

  // https://nuxt.com/modules
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  // https://eslint.nuxt.com
  eslint: {
    config: {
      standalone: false,
    },
  },

  // https://devtools.nuxt.com
  devtools: { enabled: true },

  nitro: {
    sourceMap: 'inline',
    modules: [ncb],
  },

  runtimeConfig: {
    appId: '',
    webhookSecret: '',
    privateKey: '',
    rmStaleKey: '',
    test: '' as '' | 'true',
  },

  hooks: {
    'nitro:build:before': (nitro) => {
      // Override the server routes with the client routes so they are higher priority
      const clientRenderer = resolve('node_modules/nuxt/dist/core/runtime/nitro/renderer')
      nitro.options.handlers.unshift({
        route: '/',
        handler: clientRenderer,
      })
      nitro.options.handlers.unshift({
        route: '/view/**',
        handler: clientRenderer,
      })
    },
  },
})
