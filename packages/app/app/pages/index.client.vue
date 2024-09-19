<script lang="ts" setup>
const search = useSessionStorage('search', '')

const { data, status } = useFetch('/api/repo/search', {
  query: computed(() => ({ text: search.value })),
  immediate: !!search.value,
})

const examples = [
  {
    owner: 'vitejs',
    name: 'vite',
    avatar: 'https://avatars.githubusercontent.com/u/65625612?v=4',
  },
  {
    owner: 'vuejs',
    name: 'core',
    avatar: 'https://avatars.githubusercontent.com/u/6128107?v=4',
  },
  {
    owner: 'QwikDev',
    name: 'qwik',
    avatar: 'https://avatars.githubusercontent.com/u/138123704?v=4',
  },
  {
    owner: 'Tresjs',
    name: 'tres',
    avatar: 'https://avatars.githubusercontent.com/u/119253150?v=4',
  },
]
</script>

<template>
  <div class="p-4 md:p-12 flex flex-col items-center gap-4 md:gap-12 w-screen max-w-[600px] mx-auto">
    <img src="/favicon.svg" alt="logo" width="64" height="64">

    <div class="flex flex-col gap-2 w-full">
      <UInput
        v-model="search"
        placeholder="Search for a repository..."
        icon="i-ph-magnifying-glass"
        class="w-full"
        size="xl"
      />

      <div v-if="data?.nodes.length">
        <RepoButton
          v-for="repo in data.nodes"
          :key="repo.id"
          :owner="repo.owner.login"
          :name="repo.name"
          :avatar="repo.owner.avatarUrl"
        />
      </div>

      <div v-else-if="search && status !== 'pending'" class="text-gray-500 p-12 text-center">
        No repositories found
      </div>

      <div v-else-if="!search" class="flex flex-col gap-2 mt-4">
        <div class="text-center">
          Or try it on:
        </div>
        <RepoButton
          v-for="(repo, index) in examples"
          :key="index"
          v-bind="repo"
          class="border border-gray-500/10"
        />
      </div>
    </div>

    <p class="text-center">
      Setup continuous releases with <a href="https://github.com/stackblitz-labs/pkg.pr.new" target="_blank" class="text-primary">pkg.pr.new</a> on your repository.
    </p>
  </div>
</template>
