<script setup lang="ts">
const colorMode = useColorMode();
const route = useRoute();
</script>

<template>
  <div class="flex flex-col min-h-dvh lg:min-h-screen overflow-x-clip">
    <header class="safe-header flex items-center">
      <nav>
        <UButton
          v-if="route.name !== 'home'"
          :to="{
            name: 'home',
          }"
          icon="ph-magnifying-glass"
          variant="ghost"
          class="max-lg:min-h-11 max-lg:min-w-11"
        />
      </nav>

      <div class="flex-1" />

      <ClientOnly>
        <UButton
          aria-label="Toggle theme"
          :icon="colorMode.preference === 'light' ? 'ph-sun' : 'ph-moon-stars'"
          color="neutral"
          variant="link"
          class="max-lg:min-h-11 max-lg:min-w-11"
          @click="
            colorMode.preference =
              colorMode.preference === 'dark' ? 'light' : 'dark'
          "
        />
        <template #fallback>
          <div class="w-11 h-11 lg:w-8 lg:h-8" />
        </template>
      </ClientOnly>

      <UButton
        to="https://github.com/stackblitz-labs/pkg.pr.new"
        icon="mdi-github"
        target="_blank"
        variant="ghost"
        color="neutral"
        class="max-lg:min-h-11 max-lg:min-w-11"
      />
    </header>

    <main
      :class="[route.meta.mainClass ?? 'my-container', 'min-w-0 max-w-full']"
    >
      <slot />
    </main>

    <AppFooter />
  </div>
</template>
