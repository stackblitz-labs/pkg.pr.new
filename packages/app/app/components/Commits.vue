<script lang="ts" setup>
import bash from "@shikijs/langs/bash";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import { createHighlighterCoreSync, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

interface PackageInfo {
  name: string;
  installUrl: string;
  isOnNpm: boolean;
}

type PackageManager = "npm" | "yarn" | "pnpm" | "bun" | "upm" | "nub";

const packageManagers: PackageManager[] = [
  "npm",
  "yarn",
  "pnpm",
  "bun",
  "upm",
  "nub",
];
const selectedPackageManager = ref<PackageManager>("npm");

interface RepoCommitsResponse {
  id: string;
  name: string;
  target: {
    id: string;
    history: {
      nodes: any[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
        currentPage: number;
        perPage: number;
        totalCount: number;
        totalPages: number;
      };
    };
  };
}

const props = defineProps<{
  owner: string;
  repo: string;
  withDev: boolean;
}>();

const requestFetch = useRequestFetch();

function createEmptyBranch(): RepoCommitsResponse {
  return {
    id: `releases-${props.owner}-${props.repo}`,
    name: "all refs",
    target: {
      id: `releases-target-${props.owner}-${props.repo}`,
      history: {
        nodes: [],
        pageInfo: {
          hasNextPage: false,
          endCursor: null,
          currentPage: 1,
          perPage: 10,
          totalCount: 0,
          totalPages: 1,
        },
      },
    },
  };
}

const { data, pending } = await useAsyncData<RepoCommitsResponse>(
  `repo-commits:${props.owner}:${props.repo}:page:1`,
  () =>
    requestFetch("/api/repo/commits", {
      query: {
        owner: props.owner,
        repo: props.repo,
      },
    }) as Promise<RepoCommitsResponse>,
  {
    server: false,
    lazy: true,
    default: createEmptyBranch,
  },
);

const branch = shallowReactive<RepoCommitsResponse>(createEmptyBranch());
watch(
  data,
  (next) => {
    if (!next) return;
    branch.id = next.id;
    branch.name = next.name;
    branch.target = next.target;
  },
  { immediate: true },
);

const showInitialLoading = computed(
  () => pending.value && branch.target.history.nodes.length === 0,
);

const commitsWithRelease = computed(() =>
  branch.target.history.nodes
    .filter((commit) =>
      commit.statusCheckRollup?.contexts.nodes.some(
        (context: { name: string }) => context.name === "Continuous Releases",
      ),
    )
    .map((commit) => ({
      ...commit,
      release: commit.statusCheckRollup.contexts.nodes.find(
        (context: { name: string }) => context.name === "Continuous Releases",
      )!,
    })),
);

const selectedCommit = shallowRef<
  (typeof commitsWithRelease.value)[number] | null
>(null);

function closeSelectedCommit() {
  selectedCommit.value = null;
}

let shiki: HighlighterCore | null = null;
const colorMode = useColorMode();

const highlightCache = new Map<string, string>();

function getInstallCommand(pkg: PackageInfo) {
  const descriptor =
    selectedPackageManager.value === "yarn"
      ? `${pkg.name}@${pkg.installUrl}.tgz`
      : pkg.installUrl;
  const installCommand: Record<PackageManager, string> = {
    npm: "npm i",
    yarn: "yarn add",
    pnpm: "pnpm add",
    bun: "bun add",
    upm: "upm add",
    nub: "nub add",
  };

  return `${installCommand[selectedPackageManager.value]} ${descriptor}${props.withDev ? " -D" : ""}`;
}

function highlightInstallCommand(pkg: PackageInfo) {
  const code = getInstallCommand(pkg);
  if (!shiki) return "";
  const theme = colorMode.value === "dark" ? "github-dark" : "github-light";
  const cacheKey = `${theme}::${code}`;
  const cached = highlightCache.get(cacheKey);
  if (cached) return cached;
  const html = shiki.codeToHtml(code, { theme, lang: "bash" });
  highlightCache.set(cacheKey, html);
  return html;
}

onBeforeMount(() => {
  shiki = createHighlighterCoreSync({
    themes: [githubDark, githubLight],
    langs: [bash],
    engine: createJavaScriptRegexEngine(),
  });
});

onBeforeUnmount(() => {
  shiki?.dispose();
  shiki = null;
});

const copiedPackage = ref<string | null>(null);
let copyTimeoutId: ReturnType<typeof setTimeout> | null = null;

function copyInstallCommand(pkg: PackageInfo) {
  navigator.clipboard?.writeText(getInstallCommand(pkg));
  copiedPackage.value = `${selectedPackageManager.value}:${pkg.name}`;
  if (copyTimeoutId) clearTimeout(copyTimeoutId);
  copyTimeoutId = setTimeout(() => {
    copiedPackage.value = null;
    copyTimeoutId = null;
  }, 2000);
}

// Pagination
const fetching = ref(false);
const currentPage = ref(branch.target.history.pageInfo.currentPage || 1);
const totalPages = computed(
  () => branch.target.history.pageInfo.totalPages || 1,
);
const hasNextPage = computed(() => currentPage.value < totalPages.value);
const hasPrevPage = computed(() => currentPage.value > 1);

const paginationItems = computed<(number | "...")[]>(() => {
  const total = totalPages.value;
  const page = currentPage.value;
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const items: (number | "...")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);

  if (start > 2) {
    items.push("...");
  }
  for (let i = start; i <= end; i++) {
    items.push(i);
  }
  if (end < total - 1) {
    items.push("...");
  }
  items.push(total);
  return items;
});

async function fetchPage(page: number) {
  if (fetching.value) {
    return;
  }

  try {
    fetching.value = true;
    const result = (await $fetch("/api/repo/commits", {
      query: {
        owner: props.owner,
        repo: props.repo,
        page: String(page),
      },
    })) as RepoCommitsResponse;

    currentPage.value = result.target.history.pageInfo.currentPage || page;
    branch.id = result.id;
    branch.name = result.name;
    branch.target = result.target;
  } finally {
    fetching.value = false;
  }
}

async function goNextPage() {
  if (!hasNextPage.value) {
    return;
  }
  await fetchPage(currentPage.value + 1);
}

async function goPrevPage() {
  if (!hasPrevPage.value) {
    return;
  }
  await fetchPage(currentPage.value - 1);
}
</script>

<template>
  <div class="@container flex min-w-0 flex-col gap-6">
    <div
      v-if="showInitialLoading"
      class="flex flex-col items-center gap-3 py-12"
    >
      <UIcon name="i-ph-spinner-gap" class="animate-spin text-2xl opacity-70" />
    </div>

    <div v-else class="flex flex-col gap-2">
      <div
        v-for="commit of commitsWithRelease"
        :key="commit.id"
        class="px-3 py-3 @2xl:px-4 @2xl:py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
        :class="{
          'bg-gray-100 dark:bg-gray-800': selectedCommit === commit,
        }"
        aria-role="button"
        @click="selectedCommit = commit"
      >
        <div
          class="flex min-w-0 flex-col gap-2 @2xl:flex-row @2xl:items-center @2xl:gap-2"
        >
          <div class="flex min-w-0 items-center gap-2 @2xl:flex-1">
            <UIcon name="i-ph-git-commit" class="opacity-50 flex-none" />
            <span class="truncate min-w-0 flex-1">{{ commit.message }}</span>
          </div>
          <div
            class="flex min-w-0 flex-wrap items-center gap-2 @2xl:shrink-0 @2xl:flex-nowrap"
          >
            <span class="opacity-50 flex-none whitespace-nowrap">
              {{ useTimeAgo(commit.authoredDate) }}
            </span>
            <UIcon
              v-if="commit.pinned"
              name="i-ph-push-pin"
              class="opacity-70 flex-none"
              aria-label="Pinned release"
            />
            <UButton
              v-if="commit.unverified && !commit.branch && !commit.pinned"
              color="neutral"
              variant="subtle"
              size="xs"
              :ui="{
                base: 'font-mono pointer-events-none whitespace-nowrap',
              }"
            >
              External
            </UButton>
            <UButton
              v-if="commit.branch"
              color="neutral"
              variant="subtle"
              size="xs"
              :ui="{
                base: 'font-mono pointer-events-none whitespace-nowrap shrink-0 inline-flex items-center',
              }"
            >
              <span class="block max-w-48 truncate whitespace-nowrap">
                {{ commit.branch }}
              </span>
            </UButton>
            <UButton
              :to="commit.url"
              target="_blank"
              color="neutral"
              variant="subtle"
              size="xs"
              aria-label="View Commit"
              :ui="{
                base: 'font-mono whitespace-nowrap shrink-0 inline-flex items-center',
              }"
              @click.stop
            >
              {{ commit.abbreviatedOid }}
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="commitsWithRelease.length && totalPages > 1"
      class="flex max-w-full justify-center items-center gap-1 flex-wrap"
    >
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-ph-caret-left"
        :disabled="!hasPrevPage"
        :loading="fetching"
        class="@max-md:min-h-11 @max-md:min-w-11"
        @click="goPrevPage()"
      >
        <span class="@max-md:sr-only">Prev</span>
      </UButton>

      <template v-for="(item, index) in paginationItems" :key="`page-${index}`">
        <span v-if="item === '...'" class="px-2 text-sm opacity-60">…</span>
        <UButton
          v-else
          :color="item === currentPage ? 'primary' : 'neutral'"
          :variant="item === currentPage ? 'solid' : 'subtle'"
          :disabled="fetching"
          class="@max-md:min-h-11 @max-md:min-w-11"
          @click="fetchPage(item)"
        >
          {{ item }}
        </UButton>
      </template>

      <UButton
        color="neutral"
        variant="subtle"
        icon="i-ph-caret-right"
        :disabled="!hasNextPage"
        :loading="fetching"
        class="@max-md:min-h-11 @max-md:min-w-11"
        @click="goNextPage()"
      >
        <span class="@max-md:sr-only">Next</span>
      </UButton>
    </div>

    <div
      v-if="!showInitialLoading && !commitsWithRelease.length"
      class="flex flex-col items-center gap-4 border border-gray-100 dark:border-gray-800 rounded-xl p-6 @lg:p-8"
    >
      <UIcon name="i-ph-crane-tower-light" class="text-6xl opacity-50" />
      <p class="text-center text-lg">No Continuous Releases found</p>
      <p class="text-center">
        Setup continuous releases with
        <a
          href="https://github.com/stackblitz-labs/pkg.pr.new"
          target="_blank"
          class="text-primary"
          >pkg.pr.new</a
        >
        first!
      </p>
    </div>

    <!-- Commit sidepane -->
    <USlideover
      :open="!!selectedCommit"
      :ui="{
        content: 'w-full max-w-[800px]',
      }"
      @update:open="closeSelectedCommit"
    >
      <template #content>
        <div
          v-if="selectedCommit"
          class="@container min-w-0 max-w-full p-4 flex flex-col items-stretch gap-4 overflow-auto"
        >
          <div
            class="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 @lg:flex @lg:flex-nowrap @lg:items-center"
          >
            <UButton
              icon="ph-x"
              color="neutral"
              variant="subtle"
              size="sm"
              class="mr-2 shrink-0 max-lg:min-h-11 max-lg:min-w-11"
              @click="closeSelectedCommit"
            />

            <UIcon name="i-ph-git-commit" class="opacity-50 flex-none" />
            <span class="truncate min-w-0">{{ selectedCommit.message }}</span>
            <span
              class="col-span-2 @lg:col-auto opacity-50 flex-none whitespace-nowrap"
            >
              {{ useTimeAgo(selectedCommit.authoredDate) }}
            </span>
            <span class="hidden @lg:block @lg:flex-1" />
            <UButton
              :to="selectedCommit.url"
              target="_blank"
              color="neutral"
              variant="subtle"
              size="sm"
              aria-label="View Commit"
              class="shrink-0 justify-self-end max-lg:min-h-11"
              @click.stop
            >
              {{ selectedCommit.abbreviatedOid }}
            </UButton>
          </div>

          <div
            class="min-w-0 max-w-full p-3 @lg:p-4 border border-gray-100 dark:border-gray-800 rounded-lg flex flex-col gap-3"
          >
            <div class="flex justify-end max-w-full">
              <div
                class="flex max-w-full flex-wrap justify-end gap-1 @lg:inline-flex @lg:flex-nowrap @lg:gap-0 @lg:overflow-hidden @lg:rounded-md @lg:border @lg:border-gray-200 @lg:dark:border-gray-700"
                role="group"
                aria-label="Package manager"
              >
                <UButton
                  v-for="packageManager in packageManagers"
                  :key="packageManager"
                  color="neutral"
                  :variant="
                    selectedPackageManager === packageManager
                      ? 'subtle'
                      : 'ghost'
                  "
                  size="xs"
                  :ui="{ base: 'rounded-md font-mono @lg:rounded-none' }"
                  class="@max-lg:min-h-11"
                  :aria-pressed="selectedPackageManager === packageManager"
                  @click="selectedPackageManager = packageManager"
                >
                  {{ packageManager }}
                </UButton>
              </div>
            </div>
            <div
              v-for="pkg in selectedCommit.release.packages"
              :key="pkg.name"
              class="relative group min-w-0 max-w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
            >
              <div
                class="flex items-center justify-between gap-2 px-4 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
              >
                <span
                  class="font-mono text-sm text-gray-700 dark:text-gray-300 truncate"
                >
                  {{ pkg.name }}
                </span>
                <div class="flex items-center gap-1">
                  <a
                    v-if="pkg.isOnNpm"
                    :href="`https://npmx.dev/package/${pkg.name}`"
                    target="_blank"
                    rel="noopener noreferrer"
                    :aria-label="`${pkg.name} on npmx`"
                    class="inline-flex items-center justify-center px-1.5 py-1 rounded text-gray-600 dark:text-gray-400 hover:text-primary-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <NpmxLogo class="h-3 w-auto shrink-0" />
                  </a>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    :icon="
                      copiedPackage === `${selectedPackageManager}:${pkg.name}`
                        ? 'i-ph-check-bold'
                        : 'i-ph-copy'
                    "
                    aria-label="Copy install command"
                    class="@max-lg:min-h-11 @max-lg:min-w-11"
                    @click="copyInstallCommand(pkg)"
                  />
                </div>
              </div>
              <div class="overflow-x-auto">
                <div
                  class="[&>pre]:!my-0 [&>pre]:!bg-transparent [&>pre]:!border-0 [&>pre]:!rounded-none [&>pre]:!p-4 text-sm"
                  v-html="highlightInstallCommand(pkg)"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>
