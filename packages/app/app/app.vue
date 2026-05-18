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
  description: "Continuous preview releases for your libraries.",
  ogTitle: "pkg.pr.new",
  ogDescription: "Continuous preview releases for your libraries.",
  ogType: "website",
  ogImage: "https://pkg.pr.new/og.png",
  twitterImage: "https://pkg.pr.new/og.png",
  twitterCard: "summary_large_image",
});
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="#0ea5e9" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
