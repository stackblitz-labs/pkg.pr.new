<script lang="ts" setup>
import type { RendererObject } from 'marked'
import { marked } from 'marked'

const props = defineProps<{
  owner: string
  repo: string
}>()

const data = await $fetch('/api/repo/commits', {
  query: {
    owner: props.owner,
    repo: props.repo,
  },
})

if (!data) {
  throw createError('Could not load Commits')
}

const branch = shallowReactive(data)

const commitsWithRelease = computed(() => branch.target.history.nodes.filter(commit => commit.statusCheckRollup?.contexts.nodes.some(context => context.name === 'Continuous Releases')).map(commit => ({
  ...commit,
  release: commit.statusCheckRollup.contexts.nodes.find(context => context.name === 'Continuous Releases')!,
})))

const selectedCommit = shallowRef<(typeof commitsWithRelease.value)[number] | null>(null)

// Markdown

// Add target to links
const renderer: RendererObject = {
  link(originalLink) {
    const link = marked.Renderer.prototype.link.call(this, originalLink)
    return link.replace('<a', '<a target=\'_blank\' rel=\'noreferrer\' ')
  },
}
marked.use({ renderer })

// Pagination

const fetching = ref(false)
const fetchMoreForceDisabled = ref(!commitsWithRelease.value.length)

async function fetchMore() {
  if (!branch.target.history.pageInfo.hasNextPage) {
    return
  }

  if (fetching.value) {
    return
  }

  try {
    fetching.value = true

    const cursor = branch.target.history.pageInfo.endCursor

    const result = await $fetch('/api/repo/commits', {
      query: {
        owner: props.owner,
        repo: props.repo,
        cursor,
      },
    })

    const count = commitsWithRelease.value.length

    branch.target = {
      ...branch.target,
      history: {
        ...branch.target.history,
        nodes: [
          ...branch.target.history.nodes,
          ...result.target.history.nodes,
        ],
        pageInfo: result.target.history.pageInfo,
      },
    }

    if (count === commitsWithRelease.value.length) {
      fetchMoreForceDisabled.value = true
    }
  }
  finally {
    fetching.value = false
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
      v-if="branch.target.history.pageInfo.hasNextPage && !fetchMoreForceDisabled"
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
      <p class="text-center text-lg">
        No Continuous Releases found
      </p>
      <p class="text-center">
        Setup continuous releases with <a href="https://github.com/stackblitz-labs/pkg.pr.new" target="_blank" class="text-primary">pkg.pr.new</a> first!
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
            class="max-w-full p-4 border border-gray-100 dark:border-gray-800 rounded-lg prose dark:prose-invert"
            v-html="marked(selectedCommit.release.text)"
          />
        </div>
      </template>
    </USlideover>
  </div>
</template>
