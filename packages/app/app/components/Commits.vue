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

// Markdown

// Add target to links

const colorMode = useColorMode();
let shiki: HighlighterCore;

onBeforeMount(async () => {
  // if (typeof window === 'undefined') {
  //   const { loadWasm } = await import('shiki')
  //   // @ts-expect-error ignore error
  //   await loadWasm(import(/* @vite-ignore */ 'shiki/onig.wasm'))
  // }

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
      const highlightedCode = shiki.codeToHtml(text, {
        theme: colorMode.preference === "dark" ? "github-dark" : "github-light",
        lang: "bash",
      });

      const codeId = `code-${Math.random().toString(36).substr(2, 9)}`;

      return `
        <div class="relative group my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
          <div class="flex items-center justify-end px-4 py-1 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <button 
              onclick="copyToClipboard('${codeId}', this)" 
              class="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
              title="Copy to clipboard"
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              Copy
            </button>
          </div>
          <div class="overflow-x-auto">
            <div id="${codeId}" class="[&>pre]:!my-0 [&>pre]:!bg-transparent [&>pre]:!border-0 [&>pre]:!rounded-none [&>pre]:!p-4">${highlightedCode}</div>
          </div>
        </div>
      `;
    },
  };

  marked.use({ renderer });
  if (typeof window !== "undefined") {
    (window as any).copyToClipboard = (
      elementId: string,
      buttonEl: HTMLElement,
    ) => {
      const element = document.getElementById(elementId);
      if (element) {
        const text = element.textContent || "";
        navigator.clipboard
          .writeText(text.trim())
          .then(() => {
            const originalHTML = buttonEl.innerHTML;
            buttonEl.innerHTML = `
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            Copied!
          `;
            buttonEl.classList.add("!text-green-600", "dark:!text-green-400");

            setTimeout(() => {
              buttonEl.innerHTML = originalHTML;
              buttonEl.classList.remove(
                "!text-green-600",
                "dark:!text-green-400",
              );
            }, 2000);
          })
          .catch(() => {
            const textArea = document.createElement("textarea");
            textArea.value = text.trim();
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
          });
      }
    };
  }
});

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    delete (window as any).copyToClipboard;
  }
  shiki?.dispose();
});

// Pagination
const fetching = ref(false);
const fetchMoreForceDisabled = ref(!commitsWithRelease.value.length);

async function fetchMore() {
  if (!branch.target.history.pageInfo.hasNextPage) {
    return;
  }

  if (fetching.value) {
    return;
  }

  try {
    fetching.value = true;

    const cursor = branch.target.history.pageInfo.endCursor;

    const result = await $fetch("/api/repo/commits", {
      query: {
        owner: props.owner,
        repo: props.repo,
        cursor,
      },
    });

    const count = commitsWithRelease.value.length;

    branch.target = {
      ...branch.target,
      history: {
        ...branch.target.history,
        nodes: [...branch.target.history.nodes, ...result.target.history.nodes],
        pageInfo: result.target.history.pageInfo,
      },
    };

    if (count === commitsWithRelease.value.length) {
      fetchMoreForceDisabled.value = true;
    }
  } finally {
    fetching.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="text-center flex justify-center items-center gap-1 opacity-80">
      Continuous Releases from
      <UIcon name="i-ph-git-branch" />
      {{ branch.name }}
    </div>

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
        <div class="flex items-center gap-2">
          <UIcon name="i-ph-git-commit" class="opacity-50 flex-none" />
          <span class="truncate">{{ commit.message }}</span>
          <span class="opacity-50 flex-none">
            {{ useTimeAgo(commit.authoredDate) }}
          </span>
          <span class="flex-1" />
          <UButton
            :to="commit.url"
            target="_blank"
            color="neutral"
            variant="subtle"
            size="xs"
            aria-label="View Commit"
            :ui="{
              base: 'font-mono',
            }"
            @click.stop
          >
            {{ commit.abbreviatedOid }}
          </UButton>
        </div>
      </div>
    </div>

    <div
      v-if="
        branch.target.history.pageInfo.hasNextPage && !fetchMoreForceDisabled
      "
      class="flex justify-center"
    >
      <UButton
        color="neutral"
        variant="subtle"
        :loading="fetching"
        @click="fetchMore()"
      >
        Load More
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
            class="max-w-full p-4 overflow-x-scroll border border-gray-100 dark:border-gray-800 rounded-lg prose dark:prose-invert flex flex-col gap-2"
            v-html="marked(selectedCommit.release.text)"
          />
        </div>
      </template>
    </USlideover>
  </div>
</template>
