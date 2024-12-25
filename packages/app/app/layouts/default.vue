<script setup lang="ts">
const route = useRoute()
</script>

<template>
  <div>
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
    <slot />
  </div>
</template>

<style scoped></style>
