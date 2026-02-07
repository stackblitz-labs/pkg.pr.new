<script lang="ts" setup>
import type { RepoNode } from "../../server/utils/types";

const search = useSessionStorage("search", "");
const searchResults = ref<RepoNode[]>([]);
const isLoading = ref(false);

let eventSource: EventSource | null = null;
const throttledSearch = useThrottle(search, 500, true, false);

function closeEventSource(source: EventSource) {
  source.close();
  if (eventSource === source) {
    eventSource = null;
    isLoading.value = false;
  }
}

watch(
  throttledSearch,
  async (query) => {
    if (eventSource) {
      closeEventSource(eventSource);
    }
    searchResults.value = [];

    if (!query) {
      isLoading.value = false;
      return;
    }

    isLoading.value = true;
    const source = new EventSource(
      `/api/repo/search?text=${encodeURIComponent(query)}`,
    );
    eventSource = source;

    source.onmessage = (event) => {
      if (event.data === "[DONE]") {
        closeEventSource(source);
        return;
      }

      try {
        const repo = JSON.parse(event.data) as RepoNode & { error?: string };
        if (repo.error) {
          return;
        }

        searchResults.value.push(repo);
      } catch {
        // Skip malformed JSON
      }
    };

    source.onerror = (err) => {
      console.error(err);
      closeEventSource(source);
    };
  },
  { immediate: false },
);

const examples = [
  {
    owner: "vitejs",
    name: "vite",
    avatar: "https://avatars.githubusercontent.com/u/65625612?v=4",
  },
  {
    owner: "rolldown",
    name: "rolldown",
    avatar: "https://avatars.githubusercontent.com/u/94954945?s=200&v=4",
  },
  {
    owner: "vuejs",
    name: "core",
    avatar: "https://avatars.githubusercontent.com/u/6128107?v=4",
  },
  {
    owner: "sveltejs",
    name: "svelte",
    avatar: "https://avatars.githubusercontent.com/u/23617963?s=200&v=4",
  },
  {
    owner: "Tresjs",
    name: "tres",
    avatar: "https://avatars.githubusercontent.com/u/119253150?v=4",
  },
];

const router = useRouter();
function openFirstResult() {
  const [first] = searchResults.value;
  if (first) {
    router.push({
      name: "repo:details",
      params: { owner: first.owner.login, repo: first.name },
    });
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

    <div v-if="isLoading" class="-mb-2 relative">
      <UProgress size="xs" class="absolute inset-x-0 top-0" />
    </div>

    <div v-if="searchResults.length">
      <RepoButton
        v-for="repo in searchResults"
        :key="repo.id"
        :owner="repo.owner.login"
        :name="repo.name"
        :avatar="repo.owner.avatarUrl"
      />
    </div>

    <div
      v-else-if="search && !isLoading"
      class="text-gray-500 p-12 text-center"
    >
      No repositories found
    </div>

    <div v-else-if="!search" class="flex flex-col gap-2 mt-4">
      <div class="text-center">Or try it on:</div>
      <RepoButton
        v-for="(repo, index) in examples"
        :key="index"
        v-bind="repo"
        class="border border-gray-500/10"
      />
    </div>
  </div>
</template>
