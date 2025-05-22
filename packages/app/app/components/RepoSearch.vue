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
    _stats?: {
      batchCount: number;
      scannedSoFar: number;
      matchNumber: number;
    };
  }>
>([]);
const isLoading = ref(false);
const searchError = ref<string | null>(null);
const searchStats = ref<{
  totalScanned: number;
  batchCount: number;
  lastResultIndex: number;
} | null>(null);

// Track current search request to be able to cancel it
let currentSearchController: AbortController | null = null;
let currentSearchId = 0;

const throttledSearch = useThrottle(search, 500, true, false);

// Watch for search changes and use streaming search
watch(
  throttledSearch,
  async (newValue) => {
    // Cancel any in-progress search
    if (currentSearchController) {
      console.log(`[SEARCH-CLIENT] Canceling previous search request`);
      currentSearchController.abort();
      currentSearchController = null;
    }

    if (!newValue) {
      searchResults.value = [];
      searchStats.value = null;
      return;
    }

    // Create a unique ID for this search request
    const thisSearchId = ++currentSearchId;

    try {
      searchResults.value = [];
      isLoading.value = true;
      searchError.value = null;
      searchStats.value = null;

      console.log(
        `[SEARCH-CLIENT] Starting search #${thisSearchId} for "${newValue}"`,
      );

      // Create a new controller for this request
      currentSearchController = new AbortController();
      const response = await fetch(
        `/api/repo/search?text=${encodeURIComponent(newValue)}`,
        {
          signal: currentSearchController.signal,
        },
      );

      // If this isn't the most recent search, ignore results
      if (thisSearchId !== currentSearchId) {
        console.log(
          `[SEARCH-CLIENT] Ignoring outdated search #${thisSearchId} results`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("Stream reader not available");
      }

      console.log(
        `[SEARCH-CLIENT] Stream reader initialized for "${newValue}" (search #${thisSearchId})`,
      );
      const decoder = new TextDecoder();
      let buffer = "";

      // Track IDs we've seen to prevent duplicates
      const seenIds = new Set<string>();

      while (true) {
        // If this search has been superseded, stop processing
        if (thisSearchId !== currentSearchId) {
          console.log(
            `[SEARCH-CLIENT] Abandoning outdated search #${thisSearchId} processing`,
          );
          break;
        }

        const { done, value } = await reader.read();

        if (done) {
          console.log(
            `[SEARCH-CLIENT] Stream completed for "${newValue}" (search #${thisSearchId})`,
          );
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            // Each line is now a direct result object
            const result = JSON.parse(line);

            // Skip if we've already seen this ID (client-side deduplication)
            if (seenIds.has(result.id)) {
              console.log(
                `[SEARCH-CLIENT] Skipping duplicate result: ${result.id}`,
              );
              continue;
            }

            seenIds.add(result.id);
            console.log(`[SEARCH-CLIENT] Found result:`, result.id);
            searchResults.value.push(result);

            // Update stats from the latest result
            if (result._stats) {
              searchStats.value = {
                batchCount: result._stats.batchCount,
                totalScanned: result._stats.scannedSoFar,
                lastResultIndex: result._stats.matchNumber,
              };
            }
          } catch (e) {
            console.error(
              "[SEARCH-CLIENT] Failed to parse stream data:",
              line,
              e,
            );
            searchError.value = "Failed to parse search result";
          }
        }
      }
    } catch (error: unknown) {
      // Only update error if this is still the current search
      if (thisSearchId === currentSearchId) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("[SEARCH-CLIENT] Search aborted");
        } else {
          searchError.value =
            error instanceof Error ? error.message : "Unknown error occurred";
          console.error("[SEARCH-CLIENT] Streaming search error:", error);
        }
      }
    } finally {
      // Only update loading state if this is still the current search
      if (thisSearchId === currentSearchId) {
        isLoading.value = false;
        if (currentSearchController?.signal.aborted) {
          currentSearchController = null;
        }
      }
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
        Found {{ searchStats.lastResultIndex }} results in
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
