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
  title: 'pkg.pr.new',
  description: 'Search repositories on GitHub to list their continuous releases.',
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="#0ea5e9" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
