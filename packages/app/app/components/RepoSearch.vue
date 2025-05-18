<script lang="ts" setup>
interface RepoOwner {
  login: string;
  avatarUrl: string;
}

interface RepoNode {
  name: string;
  owner: RepoOwner;
}

interface SearchStreamChunk {
  nodes?: RepoNode[];
  streaming?: boolean;
  complete?: boolean;
  error?: boolean;
  message?: string;
}

const search = useSessionStorage("search", "");
const throttledSearch = useThrottle(search, 500, true, false);
const searchResults = ref<RepoNode[]>([]);
const isLoading = ref(false);
const isComplete = ref(true);
const error = ref<string | null>(null);

watchEffect(async () => {
  if (!throttledSearch.value) {
    searchResults.value = [];
    isLoading.value = false;
    isComplete.value = true;
    return;
  }

  isLoading.value = true;
  isComplete.value = false;
  searchResults.value = [];
  error.value = null;

  try {
    const response = await fetch(
      `/api/repo/search?text=${encodeURIComponent(throttledSearch.value)}`,
    );

    if (!response.ok) {
      throw new Error(
        `Search failed: ${response.status} ${response.statusText}`,
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response stream reader");
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log("Stream complete");
        isLoading.value = false;
        isComplete.value = true;
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      console.log("Raw chunk received:", chunk);

      const lines = chunk.split("\n").filter((line) => line.trim());
      console.log("Processing", lines.length, "lines from chunk");

      for (const line of lines) {
        try {
          console.log("Processing line:", line);

          if (line === "[object Object]") {
            console.warn(
              "Received '[object Object]' instead of JSON string. Skipping.",
            );
            continue;
          }

          const data = JSON.parse(line) as SearchStreamChunk;
          console.log("Successfully parsed data:", data);

          if (data.error) {
            error.value = data.message || "Unknown error";
            isLoading.value = false;
            break;
          }

          if (data.nodes && data.nodes.length > 0) {
            searchResults.value = [...searchResults.value, ...data.nodes];
          }

          if (data.streaming === false && data.complete) {
            isLoading.value = false;
            isComplete.value = true;
          }
        } catch (e) {
          const err = e as Error;
          console.error("Error parsing JSON chunk:", err, "Content:", line);
        }
      }
    }
  } catch (e) {
    const err = e as Error;
    console.error("Error with search request:", err);
    error.value = err.message;
    isLoading.value = false;
    isComplete.value = true;
  }
});

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
  const firstResult = searchResults.value[0];
  if (firstResult) {
    router.push({
      name: "repo:details",
      params: {
        owner: firstResult.owner.login,
        repo: firstResult.name,
      },
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

    <div v-if="error" class="text-red-500 p-4 text-center">
      {{ error }}
    </div>

    <div v-else-if="searchResults.length">
      <RepoButton
        v-for="repo in searchResults"
        :key="`${repo.owner.login}-${repo.name}`"
        :owner="repo.owner.login"
        :name="repo.name"
        :avatar="repo.owner.avatarUrl"
      />
    </div>

    <div
      v-else-if="search && isComplete && !isLoading"
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
