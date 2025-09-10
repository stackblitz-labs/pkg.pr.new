<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const copied = ref(false);
const isLoading = ref(true);

const badgeUrl = computed(() => `/badge/${props.owner}/${props.repo}`);

const redirectUrl = computed(() => `/~/${props.owner}/${props.repo}`);

function copyBadgeCode() {
  const md = `[![pkg.pr.new](${badgeUrl.value})](${redirectUrl.value})`;
  navigator.clipboard.writeText(md);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <div class="inline-flex items-center gap-[2px]">
    <a :href="redirectUrl" target="_blank" rel="noopener">
      <div class="relative">
        <div
          v-if="isLoading"
          class="h-5 w-[120px] rounded bg-gray-200 dark:bg-gray-700 animate-pulse"
        />
        <img
          :src="badgeUrl"
          :alt="`pkg.pr.new badge`"
          @load="isLoading = false"
          @error="isLoading = false"
          :class="['h-5 w-auto block max-w-none', isLoading ? 'hidden' : '']"
        />
      </div>
    </a>

    <UButton
      @click="copyBadgeCode"
      size="xs"
      color="neutral"
      :icon="copied ? 'i-ph-check-bold' : 'i-ph-copy'"
      variant="ghost"
      class="!p-1 cursor-pointer"
    />
  </div>
</template>
