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
const searchStats = ref<{
  totalScanned: number;
  batchCount: number;
  query: string;
} | null>(null);

const throttledSearch = useThrottle(search, 500, true, false);

// Watch for search changes and use streaming search
watch(
  throttledSearch,
  async (newValue) => {
    if (!newValue) {
      searchResults.value = [];
      searchStats.value = null;
      return;
    }

    try {
      searchResults.value = [];
      isLoading.value = true;
      searchError.value = null;
      searchStats.value = null;

      console.log(`[SEARCH-CLIENT] Starting search for "${newValue}"`);
      const controller = new AbortController();
      const response = await fetch(
        `/api/repo/search?text=${encodeURIComponent(newValue)}`,
        {
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Stream reader not available");
      }

      console.log(
        `[SEARCH-CLIENT] Stream reader initialized for "${newValue}"`,
      );
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          console.log(`[SEARCH-CLIENT] Stream completed for "${newValue}"`);
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const data = JSON.parse(line);
            console.log(`[SEARCH-CLIENT] Received event:`, data.type);

            if (data.type === "result" && data.node) {
              console.log(`[SEARCH-CLIENT] Found result:`, data.node.id);
              searchResults.value.push(data.node);
            } else if (data.type === "error") {
              searchError.value = data.message;
            } else if (data.type === "end" && data.stats) {
              searchStats.value = data.stats;
              console.log(`[SEARCH-CLIENT] Search stats:`, data.stats);
            }
          } catch (e) {
            console.error(
              "[SEARCH-CLIENT] Failed to parse stream data:",
              line,
              e,
            );
          }
        }
      }
    } catch (error) {
      searchError.value =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("[SEARCH-CLIENT] Streaming search error:", error);
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

      <div v-if="searchStats" class="text-xs text-gray-500 mt-2 text-right">
        Found {{ searchResults.length }} results in
        {{ searchStats.batchCount }} batches (scanned
        {{ searchStats.totalScanned.toLocaleString() }} items)
      </div>
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
