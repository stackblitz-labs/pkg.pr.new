<script lang="ts" setup>
definePageMeta({
  name: "home",
  mainClass: "",
});

import { ref, onMounted } from 'vue';

// Define types for the repository and log data
interface RepositoryOwner {
  id?: string;
  login: string;
  avatar_url: string;
}

interface LatestCommit {
  sha: string;
  message: string;
  date: string;
}

interface Repository {
  id: string;
  name: string;
  owner: RepositoryOwner;
  full_name: string;
  description: string | null;
  default_branch: string;
  html_url: string;
  homepage?: string | null;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count?: number;
  indexed_at: string;
  latest_commit: LatestCommit | null;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'error' | 'success';
  data: any;
}

// State for repositories and logs
const repositories = ref<Repository[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const clientLogs = ref<LogEntry[]>([]);
const showLogs = ref(false);

// Function to add logs that will be visible in the client
const logToClient = (message: string, type: 'info' | 'error' | 'success' = 'info', data: any = null): void => {
  const timestamp = new Date().toISOString();
  const logEntry: LogEntry = {
    timestamp,
    message,
    type,
    data
  };
  clientLogs.value.unshift(logEntry);
  console.log(`[CLIENT-LOG][${type}] ${message}`, data || '');
};

// Fetch all repositories from R2 storage
const fetchRepositories = async (): Promise<void> => {
  try {
    loading.value = true;
    logToClient('Fetching repositories from R2 storage...', 'info');
    
    const response = await fetch('/api/repos');
    const responseData = await response.json() as {
      repositories: Repository[];
      error?: boolean;
      message?: string;
      debug_info?: any;
    };
    
    if (responseData.error) {
      logToClient(`Error fetching repositories: ${responseData.message || 'Unknown error'}`, 'error', responseData.debug_info);
      error.value = responseData.message || 'Unknown error';
      loading.value = false;
      return;
    }
    
    repositories.value = responseData.repositories;
    logToClient(
      `Successfully fetched ${responseData.repositories.length} repositories from R2 storage`, 
      'success', 
      responseData.debug_info
    );
    
    // Log available repositories
    repositories.value.forEach(repo => {
      logToClient(`Repository available: ${repo.full_name}`, 'info', {
        default_branch: repo.default_branch,
        latest_commit: repo.latest_commit ? 
          `${repo.latest_commit.sha.substring(0, 7)} - ${repo.latest_commit.message.split('\n')[0]}` : 
          'No commits found'
      });
    });
  } catch (e: any) {
    logToClient(`Failed to fetch repositories: ${e.message}`, 'error');
    error.value = `Failed to fetch repositories: ${e.message}`;
  } finally {
    loading.value = false;
  }
};

// Truncate long texts
const truncate = (text: string, length = 60): string => {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
};

// Format date
const formatDate = (dateString: string): string => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleString();
};

// Toggle logs visibility
const toggleLogs = (): void => {
  showLogs.value = !showLogs.value;
};

// Clear logs
const clearLogs = (): void => {
  clientLogs.value = [];
  logToClient('Logs cleared', 'info');
};

// Load repositories on mount
onMounted(() => {
  fetchRepositories();
});

// Template refs
const gettingStartedEl = useTemplateRef("getting-started");

function scrollToGettingStarted() {
  gettingStartedEl.value?.scrollIntoView({
    behavior: "smooth",
  });
}
</script>

<template>
  <div>
    <div class="my-container flex flex-col items-center gap-4 md:gap-8 min-h-[calc(100vh-80px)]">
      <img src="/favicon.svg" alt="logo" width="64" height="64" />

      <!-- Repository search -->
      <RepoSearch />

      <!-- Repository List -->
      <div class="w-full max-w-4xl mt-4">
        <h2 class="text-xl font-semibold mb-4">Available Repositories in R2 Storage</h2>
        
        <div v-if="loading" class="p-4 text-center">
          <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500 mx-auto"></div>
          <p class="mt-2">Loading repositories...</p>
        </div>
        
        <div v-else-if="error" class="p-4 border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800 rounded-lg">
          <p class="text-red-600 dark:text-red-400">{{ error }}</p>
          <button @click="fetchRepositories" class="mt-2 px-4 py-2 bg-primary-500 text-white rounded hover:bg-primary-600 transition">
            Try Again
          </button>
        </div>
        
        <div v-else-if="repositories.length === 0" class="p-4 border border-gray-300 dark:border-gray-700 rounded-lg">
          <p>No repositories found in R2 storage.</p>
        </div>
        
        <div v-else class="grid gap-4 md:grid-cols-2">
          <div v-for="repo in repositories" :key="repo.id" 
               class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition">
            <div class="flex items-center gap-3 mb-2">
              <img v-if="repo.owner.avatar_url" :src="repo.owner.avatar_url" alt="avatar" class="w-8 h-8 rounded-full" />
              <div v-else class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <span>{{ repo.owner.login[0] }}</span>
              </div>
              
              <h3 class="font-semibold">
                <NuxtLink :to="`/view/${repo.owner.login}/${repo.name}`" class="text-primary-500 hover:underline">
                  {{ repo.full_name }}
                </NuxtLink>
              </h3>
            </div>
            
            <p v-if="repo.description" class="text-sm text-gray-600 dark:text-gray-300 mb-3">
              {{ truncate(repo.description) }}
            </p>
            
            <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
              <div class="flex gap-2 items-center">
                <UIcon name="i-heroicons-code-bracket" />
                <span>Default branch: {{ repo.default_branch }}</span>
              </div>
              
              <div class="flex gap-2 items-center mt-1">
                <UIcon name="i-heroicons-star" />
                <span>{{ repo.stargazers_count || 0 }} stars</span>
              </div>
              
              <div class="mt-2">
                <p class="font-medium">Latest commit:</p>
                <div v-if="repo.latest_commit" class="bg-gray-50 dark:bg-gray-800 p-2 rounded mt-1">
                  <div class="flex gap-2 items-center">
                    <UIcon name="i-heroicons-hashtag" />
                    <span class="text-xs font-mono">{{ repo.latest_commit.sha.substring(0, 7) }}</span>
                  </div>
                  <p class="text-xs mt-1">{{ truncate(repo.latest_commit.message, 80) }}</p>
                  <p class="text-xs mt-1 text-gray-400">{{ formatDate(repo.latest_commit.date) }}</p>
                </div>
                <p v-else class="text-yellow-600 dark:text-yellow-400 italic">No commits found</p>
              </div>
              
              <div class="text-xs mt-2 text-gray-400">
                Indexed: {{ formatDate(repo.indexed_at) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Client-side Logs Panel -->
      <div class="fixed bottom-4 right-4 z-50">
        <button @click="toggleLogs" 
                class="px-4 py-2 bg-gray-700 text-white rounded-full flex items-center gap-2 hover:bg-gray-800 transition">
          <UIcon name="i-heroicons-bug-ant" />
          <span>{{ showLogs ? 'Hide' : 'Show' }} Logs</span>
          <span class="bg-red-500 rounded-full px-2 text-xs">{{ clientLogs.length }}</span>
        </button>
        
        <div v-if="showLogs" class="mt-2 bg-gray-800 text-white p-4 rounded-lg w-96 max-h-96 overflow-y-auto shadow-xl">
          <div class="flex justify-between items-center mb-2">
            <h3 class="font-bold">Client Logs</h3>
            <button @click="clearLogs" class="text-xs px-2 py-1 bg-red-600 rounded hover:bg-red-700">
              Clear
            </button>
          </div>
          
          <div v-if="clientLogs.length === 0" class="text-center py-4 text-gray-400">
            No logs yet
          </div>
          
          <div v-for="(log, index) in clientLogs" :key="index" 
               :class="`mb-2 p-2 rounded text-xs ${
                 log.type === 'error' ? 'bg-red-900/50 border-l-2 border-red-600' : 
                 log.type === 'success' ? 'bg-green-900/50 border-l-2 border-green-600' : 
                 'bg-gray-700/50 border-l-2 border-gray-500'
               }`">
            <div class="flex justify-between text-xs">
              <span class="font-mono">{{ new Date(log.timestamp).toLocaleTimeString() }}</span>
              <span :class="`font-bold ${
                log.type === 'error' ? 'text-red-400' : 
                log.type === 'success' ? 'text-green-400' : 
                'text-blue-400'
              }`">
                {{ log.type.toUpperCase() }}
              </span>
            </div>
            <div class="mt-1">{{ log.message }}</div>
            <div v-if="log.data" 
                 class="mt-1 p-1 bg-black/30 rounded font-mono text-gray-300 overflow-x-auto">
              <pre>{{ typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1"></div>

      <div
        class="flex flex-col items-center gap-2"
        @click.prevent="scrollToGettingStarted()"
      >
        <div class="text-center">
          Scroll to setup continuous releases with
          <a
            href="https://github.com/stackblitz-labs/pkg.pr.new"
            target="_blank"
            class="text-primary-500"
            >pkg.pr.new</a
          >
        </div>

        <div class="flex flex-col mt-2">
          <UIcon
            v-for="n in 3"
            :key="n"
            name="ph-caret-down"
            class="text-primary-500 animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite] -mt-2"
            :style="{
              animationDelay: `${n * 0.25}s`,
            }"
          />
        </div>
      </div>
    </div>

    <div
      ref="getting-started"
      class="min-h-screen p-6 flex items-center bg-gray-100 dark:bg-gray-800"
    >
      <GettingStarted id="getting-started" class="my-container" />
    </div>
  </div>
</template>

<style scoped>
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
