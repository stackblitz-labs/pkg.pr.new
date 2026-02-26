<script lang="ts" setup>
import type { RendererObject } from "marked";
import bash from "@shikijs/langs/bash";
import githubDark from "@shikijs/themes/github-dark";
import githubLight from "@shikijs/themes/github-light";
import { marked } from "marked";
import { createHighlighterCoreSync, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const data = await $fetch("/api/repo/commits", {
  query: {
    owner: props.owner,
    repo: props.repo,
  },
});

if (!data) {
  throw createError("Could not load Commits");
}

const branch = shallowReactive(data);

const commitsWithRelease = computed(() =>
  branch.target.history.nodes
    .filter((commit) =>
      commit.statusCheckRollup?.contexts.nodes.some(
        (context) => context.name === "Continuous Releases",
      ),
    )
    .map((commit) => ({
      ...commit,
      release: commit.statusCheckRollup.contexts.nodes.find(
        (context) => context.name === "Continuous Releases",
      )!,
    })),
);

const selectedCommit = shallowRef<
  (typeof commitsWithRelease.value)[number] | null
>(null);

let shiki: HighlighterCore;

onBeforeMount(async () => {
  shiki = createHighlighterCoreSync({
    themes: [githubDark, githubLight],
    langs: [bash],
    engine: createJavaScriptRegexEngine(),
  });

  const renderer: RendererObject = {
    link(originalLink) {
      const link = marked.Renderer.prototype.link.call(this, originalLink);
      return link.replace(
        "<a",
        "<a target='_blank' rel='noreferrer' class='text-primary underline'",
      );
    },
    code({ text }) {
      const currentTheme = document.documentElement.classList.contains("dark")
        ? "github-dark"
        : "github-light";
      const highlightedCode = shiki.codeToHtml(text, {
        theme: currentTheme,
        lang: "bash",
      });

      function copyCodeHandler(this: HTMLButtonElement, codeText: string) {
        navigator.clipboard?.writeText(codeText);
        if (this.dataset.timeoutId) {
          clearTimeout(parseInt(this.dataset.timeoutId));
        }
        this.textContent = "Copied!";
        this.classList.add("!text-green-600", "dark:!text-green-400");
        const timeoutId = setTimeout(() => {
          this.textContent = "Copy";
          this.classList.remove("!text-green-600", "dark:!text-green-400");
          delete this.dataset.timeoutId;
        }, 2000);
        this.dataset.timeoutId = timeoutId.toString();
      }

      return `
        <div class="relative group my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
          <div class="flex items-center justify-end px-4 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button
              onclick='(${copyCodeHandler.toString()}).call(this, ${JSON.stringify(text)})'
              class="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
              title="Copy to clipboard"
            >
              Copy
            </button>
          </div>
          <div class="overflow-x-auto">
            <div class="[&>pre]:!my-0 [&>pre]:!bg-transparent [&>pre]:!border-0 [&>pre]:!rounded-none [&>pre]:!p-4">${highlightedCode}</div>
          </div>
        </div>
      `;
    },
  };

  marked.use({ renderer });
});

onBeforeUnmount(() => {
  shiki?.dispose();
});

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
    const result = await $fetch("/api/repo/commits", {
      query: {
        owner: props.owner,
        repo: props.repo,
        page: String(page),
      },
    });

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
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <div
        v-for="commit of commitsWithRelease"
        :key="commit.id"
        class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
        :class="{
          'bg-gray-100 dark:bg-gray-800': selectedCommit === commit,
        }"
        aria-role="button"
        @click="selectedCommit = commit"
      >
        <div class="flex items-center gap-2 min-w-0">
          <UIcon name="i-ph-git-commit" class="opacity-50 flex-none" />
          <span class="truncate min-w-0 flex-1">{{ commit.message }}</span>
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

    <div class="flex justify-center items-center gap-1 flex-wrap">
      <UButton
        color="neutral"
        variant="subtle"
        icon="i-ph-caret-left"
        :disabled="!hasPrevPage"
        :loading="fetching"
        @click="goPrevPage()"
      >
        Prev
      </UButton>

      <template v-for="(item, index) in paginationItems" :key="`page-${index}`">
        <span v-if="item === '...'" class="px-2 text-sm opacity-60">…</span>
        <UButton
          v-else
          :color="item === currentPage ? 'primary' : 'neutral'"
          :variant="item === currentPage ? 'solid' : 'subtle'"
          :disabled="fetching"
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
        @click="goNextPage()"
      >
        Next
      </UButton>
    </div>

    <div
      v-if="!commitsWithRelease.length"
      class="flex flex-col items-center gap-4 border border-gray-100 dark:border-gray-800 rounded-xl p-8"
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
        content: 'w-screen max-w-[800px]',
      }"
      @update:open="selectedCommit = null"
    >
      <template #content>
        <div
          v-if="selectedCommit"
          class="p-4 flex flex-col items-stretch gap-4 overflow-auto"
        >
          <div class="flex items-center gap-2">
            <UButton
              icon="ph-x"
              color="neutral"
              variant="subtle"
              size="sm"
              class="mr-2"
              @click="selectedCommit = null"
            />

            <UIcon name="i-ph-git-commit" class="opacity-50 flex-none" />
            <span class="truncate">{{ selectedCommit.message }}</span>
            <span class="opacity-50 flex-none">
              {{ useTimeAgo(selectedCommit.authoredDate) }}
            </span>
            <span class="flex-1" />
            <UButton
              :to="selectedCommit.url"
              target="_blank"
              color="neutral"
              variant="subtle"
              size="sm"
              aria-label="View Commit"
              @click.stop
            >
              {{ selectedCommit.abbreviatedOid }}
            </UButton>
          </div>

          <div
            class="max-w-full p-4 overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-lg prose dark:prose-invert flex flex-col gap-2"
            v-html="marked(selectedCommit.release.text)"
          />
        </div>
      </template>
    </USlideover>
  </div>
</template>
