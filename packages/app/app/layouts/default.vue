<script setup lang="ts">
const colorMode = useColorMode()
const route = useRoute()
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <header class="p-6 flex items-center">
      <nav>
        <UButton
          v-if="route.name !== 'home'"
          :to="{
            name: 'home',
          }"
          icon="ph-magnifying-glass"
          variant="ghost"
        />
      </nav>

      <div class="flex-1" />

      <ClientOnly>
        <UButton
          aria-label="Toggle theme"
          :icon="colorMode.preference === 'dark'
            ? 'ph-moon'
            : colorMode.preference === 'light'
              ? 'ph-sun'
              : 'ph-moon-stars' "
          color="neutral"
          variant="link"
          @click="colorMode.preference = colorMode.preference === 'dark'
            ? 'system'
            : colorMode.preference === 'system'
              ? 'light' : 'dark'"
        />
        <template #fallback>
          <div class="w-8 h-8" />
        </template>
      </ClientOnly>

      <UButton
        to="https://github.com/stackblitz-labs/pkg.pr.new"
        icon="mdi-github"
        target="_blank"
        variant="ghost"
        color="neutral"
      />
    </header>

    <main :class="route.meta.mainClass ?? 'my-container'">
      <slot />
    </main>

    <AppFooter />
  </div>
</template>
