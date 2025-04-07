import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    deps: {
      optimizer: {
        ssr: {
          include: [
            '@simulacrum/github-api-simulator',
            '@jsdevtools/ez-spawn',
            '@octokit',
            '@nuxt',
            '@vueuse',
            'vue',
            '@iconify',
            '@tanstack',
            'query-registry',
          ]
        }
      }
    },
    environment: 'node',
    testTimeout: 30000,
  },
});
