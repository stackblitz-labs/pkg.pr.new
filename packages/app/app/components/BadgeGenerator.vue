<script setup lang="ts">
const props = defineProps<{
  owner: string;
  repo: string;
}>();

const copied = ref(false);

const baseUrl = process.client ? window.location.origin : "https://pkg.pr.new";
const badgeUrl = `${baseUrl}/badge/${props.owner}/${props.repo}`;
const redirectUrl = `${baseUrl}/~/${props.owner}/${props.repo}`;

function copyBadgeCode() {
  const badgeCode = `[![${props.repo}](${badgeUrl})](${redirectUrl})`;
  navigator.clipboard.writeText(badgeCode);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}
</script>

<template>
  <div
    class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
  >
    <span class="text-xs font-medium">Add a badge to your README</span>

    <img :src="badgeUrl" :alt="`${repo} badge`" height="16" class="h-4" />

    <UButton
      @click="copyBadgeCode"
      size="xs"
      color="primary"
      :icon="copied ? 'i-ph-check-bold' : 'i-ph-copy'"
      variant="ghost"
      class="ml-auto"
    />
  </div>
</template>
