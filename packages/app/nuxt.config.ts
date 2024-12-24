import ncb from 'nitro-cloudflare-dev'

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
})
