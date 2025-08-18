<script lang="ts" setup>
import type { RepoNode } from "../../server/utils/types";

interface SearchDebugInfo {
  startTime: string;
  endTime: string;
  totalElapsedMs: number;
  processedRepositories: number;
  matchesFound: number;
  averageProcessingTimePerRepo: number;
  repositoriesPerSecond: number;
  searchQuery: string;
  status: "completed" | "aborted" | "error";
  errorMessage?: string;
}

const search = useSessionStorage("search", "");
const searchResults = ref<RepoNode[]>([]);
const isLoading = ref(false);
const debugInfo = ref<SearchDebugInfo | null>(null);
const showDebug = ref(false);

let activeController: AbortController | null = null;
const throttledSearch = useThrottle(search, 500, true, false);

watch(
  throttledSearch,
  async (newValue) => {
    activeController?.abort();
    searchResults.value = [];
    debugInfo.value = null;
    if (!newValue) {
      isLoading.value = false;
      return;
    }

    const controller = new AbortController();
    activeController = controller;

    isLoading.value = true;
    const clientStartTime = Date.now();

    try {
      const response = await fetch(
        `/api/repo/search?text=${encodeURIComponent(newValue)}`,
        { signal: activeController.signal },
      );
      const data = (await response.json()) as {
        nodes: RepoNode[];
        debug?: SearchDebugInfo;
      };
      if (activeController === controller) {
        searchResults.value = data.nodes ?? [];

        // Add client-side timing to debug info
        if (data.debug) {
          const clientElapsed = Date.now() - clientStartTime;
          debugInfo.value = {
            ...data.debug,
            clientRequestTime: clientElapsed, // Add client timing
          } as SearchDebugInfo & { clientRequestTime: number };
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error(err);
        debugInfo.value = {
          startTime: new Date(clientStartTime).toISOString(),
          endTime: new Date().toISOString(),
          totalElapsedMs: Date.now() - clientStartTime,
          processedRepositories: 0,
          matchesFound: 0,
          averageProcessingTimePerRepo: 0,
          repositoriesPerSecond: 0,
          searchQuery: newValue,
          status: "error",
          errorMessage: err.message,
        };
      }
    } finally {
      if (activeController === controller) {
        isLoading.value = false;
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

    <div v-if="debugInfo && search" class="mb-2">
      <UButton
        variant="ghost"
        size="sm"
        @click="showDebug = !showDebug"
        class="text-xs text-gray-600"
      >
        {{ showDebug ? "Hide" : "Show" }} Search Stats
        <UIcon
          :name="showDebug ? 'i-ph-caret-up' : 'i-ph-caret-down'"
          class="ml-1"
        />
      </UButton>

      <UCard v-if="showDebug" class="mt-2 text-xs">
        <template #header>
          <div class="flex items-center justify-between">
            <span class="font-semibold">Search Performance Stats</span>
            <UBadge
              :color="
                debugInfo.status === 'completed'
                  ? 'success'
                  : debugInfo.status === 'error'
                    ? 'error'
                    : 'warning'
              "
              variant="subtle"
            >
              {{ debugInfo.status }}
            </UBadge>
          </div>
        </template>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="font-medium text-gray-700 mb-2">Server Performance</div>
            <div class="space-y-1 text-gray-600">
              <div>
                Total Time:
                <span class="font-mono"
                  >{{ debugInfo.totalElapsedMs.toFixed(0) }}ms</span
                >
              </div>
              <div>
                Repositories Processed:
                <span class="font-mono">{{
                  debugInfo.processedRepositories.toLocaleString()
                }}</span>
              </div>
              <div>
                Matches Found:
                <span class="font-mono">{{ debugInfo.matchesFound }}</span>
              </div>
              <div>
                Avg Time/Repo:
                <span class="font-mono"
                  >{{
                    debugInfo.averageProcessingTimePerRepo.toFixed(2)
                  }}ms</span
                >
              </div>
              <div>
                Processing Rate:
                <span class="font-mono"
                  >{{ debugInfo.repositoriesPerSecond.toFixed(1) }}/sec</span
                >
              </div>
            </div>
          </div>

          <div>
            <div class="font-medium text-gray-700 mb-2">Request Details</div>
            <div class="space-y-1 text-gray-600">
              <div>
                Query:
                <span class="font-mono">"{{ debugInfo.searchQuery }}"</span>
              </div>
              <div>
                Started:
                <span class="font-mono">{{
                  new Date(debugInfo.startTime).toLocaleTimeString()
                }}</span>
              </div>
              <div>
                Finished:
                <span class="font-mono">{{
                  new Date(debugInfo.endTime).toLocaleTimeString()
                }}</span>
              </div>
              <div v-if="'clientRequestTime' in debugInfo">
                Client Time:
                <span class="font-mono"
                  >{{ (debugInfo as any).clientRequestTime }}ms</span
                >
              </div>
              <div v-if="debugInfo.errorMessage" class="text-red-600">
                Error: {{ debugInfo.errorMessage }}
              </div>
            </div>
          </div>
        </div>
      </UCard>
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
