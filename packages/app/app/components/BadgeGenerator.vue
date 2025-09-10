<script setup lang="ts">
import { ref, computed, onMounted } from "vue";

const props = defineProps<{
  owner: string;
  repo: string;
}>();

const copied = ref(false);
const isLoading = ref(true);
const imgEl = ref<HTMLImageElement | null>(null);

const badgeUrl = computed(() => `/badge/${props.owner}/${props.repo}`);

const redirectUrl = computed(() => `/~/${props.owner}/${props.repo}`);

function copyBadgeCode() {
  const md = `[![pkg.pr.new](${badgeUrl.value})](${redirectUrl.value})`;
  navigator.clipboard.writeText(md);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

onMounted(() => {
  if (imgEl.value && imgEl.value.complete && imgEl.value.naturalWidth > 0) {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="inline-flex items-center gap-[2px]">
    <div class="inline-flex items-center">
      <a :href="redirectUrl" class="flex" target="_blank" rel="noopener">
        <div class="relative inline-block">
          <div
            v-if="isLoading"
            class="h-5 w-[120px] rounded bg-gray-200 dark:bg-gray-700 animate-pulse"
          />
          <img
            ref="imgEl"
            :src="badgeUrl"
            :alt="`pkg.pr.new badge`"
            @load="isLoading = false"
            @error="isLoading = false"
            :class="[
              'h-5 w-auto block max-w-none transition-opacity',
              isLoading ? 'hidden' : 'block',
            ]"
          />
        </div>
      </a>
      <div
        v-if="isLoading"
        class="h-5 w-5 rounded bg-gray-200 dark:bg-gray-700 animate-pulse ml-1"
      />
      <UButton
        v-else
        @click="copyBadgeCode"
        size="xs"
        color="neutral"
        :icon="copied ? 'i-ph-check-bold' : 'i-ph-copy'"
        variant="ghost"
        class="!p-1 cursor-pointer ml-1"
      />
    </div>
  </div>
</template>
