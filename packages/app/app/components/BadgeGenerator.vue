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
  <div class="flex flex-col gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
    <h3 class="font-semibold">Add a badge to your README</h3>

    <div class="flex items-center gap-2">
      <img :src="badgeUrl" :alt="`${repo} badge`" height="20" class="h-5" />
      <UButton
        @click="copyBadgeCode"
        size="sm"
        color="primary"
        :icon="copied ? 'i-ph-check-bold' : 'i-ph-copy'"
      >
        {{ copied ? "Copied!" : "Copy Markdown" }}
      </UButton>
    </div>

    <div class="text-xs text-gray-500">
      Add this badge to your README to help promote pkg.pr.new
    </div>
  </div>
</template>
