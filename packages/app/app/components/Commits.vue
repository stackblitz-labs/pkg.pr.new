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

type BranchesResponse = {
  branches: string[];
};

const [data, branchesResponse] = await Promise.all([
  $fetch("/api/repo/commits", {
    query: {
      owner: props.owner,
      repo: props.repo,
    },
  }),
  $fetch<BranchesResponse>("/api/repo/branches", {
    query: {
      owner: props.owner,
      repo: props.repo,
    },
  }).catch(() => null),
]);

if (!data) {
  throw createError("Could not load Commits");
}

const branch = shallowReactive(data);
const selectedBranch = ref(branch.name);
const availableBranches = ref<string[]>(
  branchesResponse?.branches?.length ? branchesResponse.branches : [branch.name],
);

if (!availableBranches.value.includes(branch.name)) {
  availableBranches.value.unshift(branch.name);
}

const commitsWithRelease = computed(() =>
  branch.target.history.nodes
    .flatMap((commit) => {
      const release = commit.statusCheckRollup?.contexts.nodes.find(
        (context) => context.name === "Continuous Releases",
      );

      return release
        ? [
            {
              ...commit,
              release,
            },
          ]
        : [];
    }),
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
const fetchMoreForceDisabled = ref(!commitsWithRelease.value.length);
const switchingBranch = ref(false);

async function loadBranch(branchName: string) {
  if (switchingBranch.value) {
    return;
  }

  const previousBranch = branch.name;

  try {
    switchingBranch.value = true;
    selectedCommit.value = null;

    const result = await $fetch("/api/repo/commits", {
      query: {
        owner: props.owner,
        repo: props.repo,
        branch: branchName,
      },
    });

    Object.assign(branch, result);
    fetchMoreForceDisabled.value = !commitsWithRelease.value.length;
  } catch (error) {
    selectedBranch.value = previousBranch;
  } finally {
    switchingBranch.value = false;
  }
}

async function onBranchChange() {
  await loadBranch(selectedBranch.value);
}

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
        branch: selectedBranch.value,
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
    <div class="text-center flex justify-center items-center gap-2 opacity-80">
      Continuous Releases from
      <UIcon name="i-ph-git-branch" />
      <select
        v-model="selectedBranch"
        class="px-2 py-1 rounded-md bg-transparent border border-gray-300 dark:border-gray-700 text-sm"
        :disabled="switchingBranch"
        @change="onBranchChange"
      >
        <option
          v-for="branchName of availableBranches"
          :key="branchName"
          :value="branchName"
        >
          {{ branchName }}
        </option>
      </select>
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
            class="max-w-full p-4 overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-lg prose dark:prose-invert flex flex-col gap-2"
            v-html="marked(selectedCommit.release.text)"
          />
        </div>
      </template>
    </USlideover>
  </div>
</template>
