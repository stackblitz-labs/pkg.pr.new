// import ncb from "nitro-cloudflare-dev";
import { resolve } from "pathe";

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

  hooks: {
    "nitro:build:before": (nitro) => {
      // Override the server routes with the client routes so they are higher priority
      const clientRenderer = resolve(
        "node_modules/nuxt/dist/core/runtime/nitro/renderer",
      );
      nitro.options.handlers.unshift({
        route: "/",
        handler: clientRenderer,
      });
      nitro.options.handlers.unshift({
        route: "/~/**",
        handler: clientRenderer,
      });
    },
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
