<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div class="flex flex-col min-h-screen">
    <nav class="p-6 flex items-center">
      <UButton
        v-if="route.name !== 'home'"
        :to="{
          name: 'home',
        }"
        icon="ph-magnifying-glass"
        variant="ghost"
      />

      <div class="flex-1" />

      <UButton
        to="https://github.com/stackblitz-labs/pkg.pr.new"
        icon="mdi-github"
        target="_blank"
        variant="ghost"
        color="neutral"
      />
    </nav>

    <main class="flex-1 p-4 sm:p-6 lg:p-8 w-screen max-w-192 mx-auto">
      <slot />
    </main>

    <footer class="text-center p-12 opacity-50 hover:opacity-100 focus-within:opacity-100">
      Made with ❤️ by <a href="https://github.com/Akryum" target="_blank" class="text-primary">Akryum</a>
    </footer>
  </div>
</template>

<style scoped></style>
