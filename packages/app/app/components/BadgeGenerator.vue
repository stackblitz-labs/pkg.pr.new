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
  <div class="inline-flex items-center gap-1">
    <img :src="badgeUrl" :alt="`${repo} badge`" class="h-[20px]" />

    <UButton
      @click="copyBadgeCode"
      size="xs"
      color="gray"
      :icon="copied ? 'i-ph-check-bold' : 'i-ph-copy'"
      variant="ghost"
      class="!p-1"
    />
  </div>
</template>
