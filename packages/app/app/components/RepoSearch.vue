<script lang="ts" setup>
const search = useSessionStorage("search", "");
const searchResults = ref<
  Array<{
    id: string;
    name: string;
    owner: {
      login: string;
      avatarUrl: string;
    };
  }>
>([]);
const isLoading = ref(false);
const searchError = ref<string | null>(null);

let activeController: AbortController | null = null;

const throttledSearch = useThrottle(search, 500, true, false);

watch(
  throttledSearch,
  async (newValue) => {
    activeController?.abort();

    searchResults.value = [];

    if (!newValue) {
      isLoading.value = false;
      return;
    }

    try {
      isLoading.value = true;
      searchError.value = null;

      activeController = new AbortController();

      const response = await fetch(
        `/api/repo/search?text=${encodeURIComponent(newValue)}`,
        { signal: activeController.signal },
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Stream reader not available");
      }

      const seenIds = new Set<string>();
      const textDecoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += textDecoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            try {
              const result = JSON.parse(line);

              if (seenIds.has(result.id)) continue;

              seenIds.add(result.id);
              searchResults.value.push(result);
            } catch (e) {
              console.error("Failed to parse search result:", line);
            }
          }
        }
      } catch (readerError) {
        if (
          !(readerError instanceof Error && readerError.name === "AbortError")
        ) {
          throw readerError;
        }
      }
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        searchError.value =
          error instanceof Error ? error.message : "Unknown error occurred";
      }
    } finally {
      isLoading.value = false;
    }
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
  if (searchResults.value.length > 0) {
    const result = searchResults.value[0];
    if (result && result.owner && result.name) {
      router.push({
        name: "repo:details",
        params: {
          owner: result.owner.login,
          repo: result.name,
        },
      });
    }
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

    <div v-if="searchError" class="text-red-500 p-2">
      {{ searchError }}
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
