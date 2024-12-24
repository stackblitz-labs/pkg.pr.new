<script setup>
useHead({
  htmlAttrs: {
    lang: 'en',
  },
  link: [
    { rel: 'icon', href: '/favicon.png' },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  ],
})

useSeoMeta({
  title: 'Continuous Releases',
  description: 'Search repositories on GitHub to list their continuous releases.',
})
</script>

<template>
  <UApp>
    <div class="flex flex-col min-h-screen">
      <div class="flex-1">
        <NuxtLoadingIndicator color="orange" />
        <NuxtPage />
      </div>

      <footer class="text-center p-12 opacity-50 hover:opacity-100 focus-within:opacity-100">
        Made with ❤️ by <a href="https://github.com/Akryum" target="_blank" class="text-primary">Akryum</a>
      </footer>
    </div>
  </UApp>
</template>
