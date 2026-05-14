<script setup>
useHead({
  htmlAttrs: {
    lang: "en",
  },
  link: [
    { rel: "icon", href: "/favicon.png" },
    { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
  ],
});

useSeoMeta({
  title: "pkg.pr.new",
  description: "Search repositories to list their continuous releases.",
  ogTitle: "pkg.pr.new",
  ogDescription: "Continuous (pre)Releases for your libraries.",
  ogType: "website",
  twitterCard: "summary_large_image",
});

defineOgImageComponent("Brand");
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="#0ea5e9" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
