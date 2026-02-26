// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  sourcemap: true,
  compatibilityDate: "2024-07-30",

  // https://nuxt.com/docs/getting-started/upgrade#testing-nuxt-4
  future: { compatibilityVersion: 4 },

  // https://nuxt.com/modules
  modules: ["@nuxt/eslint", "@nuxt/ui", "@vueuse/nuxt", "nitro-cloudflare-dev"],

  css: ["~/assets/css/main.css"],

  // https://eslint.nuxt.com
  eslint: {
    config: {
      standalone: false,
    },
  },

  // https://devtools.nuxt.com
  devtools: { enabled: true },

  nitro: {
    preset: "cloudflare-pages",
    sourceMap: "inline",
    compatibilityDate: "2024-09-19",
    externals: {
      inline: [
        "@octokit",
        "@vue",
        "vue",
        "@tanstack",
        "@vueuse",
        "@iconify",
        "@nuxt",
        "nuxt",
        "query-registry",
        "@simulacrum",
        "@jsdevtools",
      ],
    },
  },

  routeRules: {
    "/~/**": {
      headers: {
        "cache-control":
          "public, max-age=30, s-maxage=120, stale-while-revalidate=300",
      },
    },
  },

  runtimeConfig: {
    nitro: {
      envPrefix: "NITRO_",
    },
    appId: "",
    webhookSecret: "",
    privateKey: "",
    rmStaleKey: "",
    ghBaseUrl: "https://api.github.com",
    test: "",
  },

  icon: {
    clientBundle: {
      icons: ["mdi-github"],
      // scan all components in the project and include icons
      scan: true,
      // guard for uncompressed bundle size, will fail the build if exceeds
      sizeLimitKb: 256,
    },
  },
});
