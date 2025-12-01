<script lang="ts" setup>
import type { RepoNode } from "../../server/utils/types";

const search = useSessionStorage("search", "");
const searchResults = ref<RepoNode[]>([]);
const isLoading = ref(false);

let abortController: AbortController | null = null;
const throttledSearch = useThrottle(search, 500, true, false);

watch(
  throttledSearch,
  async (query) => {
    abortController?.abort();
    searchResults.value = [];

    if (!query) {
      isLoading.value = false;
      return;
    }

    const controller = new AbortController();
    abortController = controller;
    isLoading.value = true;

    try {
      const response = await fetch(
        `/api/repo/search?text=${encodeURIComponent(query)}`,
        { signal: controller.signal },
      );

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const repo = JSON.parse(data) as RepoNode & { error?: string };
            if (repo.error) continue;

            // Insert sorted by stars, keep top 10
            const idx = searchResults.value.findIndex((r) => r.stars < repo.stars);
            searchResults.value.splice(idx === -1 ? searchResults.value.length : idx, 0, repo);
            if (searchResults.value.length > 10) searchResults.value.pop();
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") console.error(err);
    } finally {
      if (abortController === controller) isLoading.value = false;
    }
  },
  { immediate: false },
);

const examples = [
  { owner: "vitejs", name: "vite", avatar: "https://avatars.githubusercontent.com/u/65625612?v=4" },
  { owner: "rolldown", name: "rolldown", avatar: "https://avatars.githubusercontent.com/u/94954945?s=200&v=4" },
  { owner: "vuejs", name: "core", avatar: "https://avatars.githubusercontent.com/u/6128107?v=4" },
  { owner: "sveltejs", name: "svelte", avatar: "https://avatars.githubusercontent.com/u/23617963?s=200&v=4" },
  { owner: "Tresjs", name: "tres", avatar: "https://avatars.githubusercontent.com/u/119253150?v=4" },
];

const router = useRouter();
function openFirstResult() {
  const [first] = searchResults.value;
  if (first) {
    router.push({ name: "repo:details", params: { owner: first.owner.login, repo: first.name } });
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

    <div v-else-if="search && !isLoading" class="text-gray-500 p-12 text-center">
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
