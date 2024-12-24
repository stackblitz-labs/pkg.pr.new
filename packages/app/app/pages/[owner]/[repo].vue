<script setup lang="ts">
const colorMode = useColorMode()
const route = useRoute()
const { data } = await useFetch('/api/repo', {
  query: computed(() => ({
    owner: route.params.owner,
    repo: route.params.repo,
  })),
})

if (!data.value) {
  throw createError('Could not load Repository')
}

const repository = data.value

definePageMeta({
  layout: 'main',
})
useHead({
  link: [
    { rel: 'icon', href: '/favicon.png' },
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    // { rel: 'alternate', type: 'application/rss+xml', title: `${repository.value.name} Continuous Releases`, href: '/feed.xml' },
  ],
})
useSeoMeta({
  title: `${repository.owner.login}/${repository.name} Continuous Releases`,
  description: `See all ${repository.name} recent continuous releases.`,
  ogTitle: `${repository.owner.login}/${repository.name} Continuous Releases`,
  ogDescription: `See all ${repository.name} recent continuous releases.`,
  // twitterCard: 'summary_large_image',
  // // Feel free to change this image with your own once deployed to NuxtHub
  // ogImage: 'https://assets.hub.nuxt.com/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL3Bycy5hdGludXguY29tIiwiaWF0IjoxNzI0MTYwMTkxfQ.yYRD-Gs6EyYQSfg27fZVx1Kle7nq7QBSciDui-mbnnU.jpg?theme=light',
  // twitterImage: 'https://assets.hub.nuxt.com/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL3Bycy5hdGludXguY29tIiwiaWF0IjoxNzI0MTYwMTkxfQ.yYRD-Gs6EyYQSfg27fZVx1Kle7nq7QBSciDui-mbnnU.jpg?theme=light',
})
// TODO: OG Image
</script>

<template>
  <UContainer class="p-4 sm:p-6 lg:p-8 max-w-3xl space-y-6">
    <div class="flex flex-col items-center gap-2">
      <a :href="repository.url" target="_blank">
        <UAvatar
          :src="repository.owner.avatarUrl"
          :alt="repository.name"
          size="xl"
        />
      </a>
      <h1 class="text-2xl sm:text-3xl text-center">
        <a :href="repository.url" target="_blank">
          {{ repository.owner.login }}
          <span class="opacity-50">/</span>
          {{ repository.name }}
        </a>
      </h1>
      <div class="flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300">
        <ClientOnly>
          <UButton
            :aria-label="`Toggle ${colorMode.value === 'dark' ? 'light' : 'dark'} mode`"
            :icon="colorMode.value === 'dark' ? 'i-ph-moon-stars' : 'i-ph-sun'"
            color="neutral"
            variant="link"
            @click="colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'"
          />
          <template #fallback>
            <div class="w-8 h-8" />
          </template>
        </ClientOnly>
        <UButton
          :to="repository.url"
          external
          target="_blank"
          :aria-label="`${repository.name}'s GitHub Repository`"
          icon="i-ph-github-logo"
          color="neutral"
          variant="link"
        />
        <UButton
          v-if="repository.homepageUrl"
          :to="repository.homepageUrl"
          external
          target="_blank"
          :aria-label="`${repository.name}'s Homepage`"
          icon="i-ph-globe-simple"
          color="neutral"
          variant="link"
        />
        <!-- <UButton
          to="/feed.xml"
          external
          target="_blank"
          aria-label="RSS Feed"
          icon="i-ph-rss-simple-duotone"
          color="neutral"
          variant="link"
        /> -->
      </div>
    </div>

    <Commits :owner="repository.owner.login" :repo="repository.name" />
  </UContainer>
</template>
