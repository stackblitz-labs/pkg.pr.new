<script lang="ts" setup>
const search = useSessionStorage('search', '')

const throttledSearch = useThrottle(search, 500, true, false)

const { data, status } = useFetch('/api/repo/search', {
  query: computed(() => ({ text: throttledSearch.value })),
  immediate: !!throttledSearch.value,
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

const router = useRouter()

function openFirstResult() {
  if (data.value?.nodes[0]) {
    const { owner, name } = data.value.nodes[0]
    router.push({
      name: 'repo:details',
      params: {
        owner: owner.login,
        repo: name,
      },
    })
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 w-full">
    <UInput
      v-model="search"
      placeholder="Search for a repository..."
      icon="i-ph-magnifying-glass"
      class="w-full"
      size="xl"
      autofocus
      @keydown.enter="openFirstResult()"
    />

    <div v-if="status === 'pending'" class="-mb-2 relative">
      <UProgress size="xs" class="absolute inset-x-0 top-0" />
    </div>

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
</template>
