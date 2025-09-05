<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

const props = defineProps<{
  owner: string;
  repo: string;
  color?: string;
  releaseCount: number;
}>();

const copied = ref(false);
const style = "flat";
const color = props.color || "000";

const baseUrl = ref("https://pkg.pr.new");

onMounted(() => {
  baseUrl.value = window.location.origin;
});

const badgeUrl = computed(() => {
  return `${baseUrl.value}/badge/${props.owner}/${props.repo}?color=${color}&style=${style}`;
});

const redirectUrl = computed(
  () => `${baseUrl.value}/~/${props.owner}/${props.repo}`,
);

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
      <img
        :src="badgeUrl"
        :alt="`pkg.pr.new badge`"
        class="h-5 w-auto block max-w-none"
      />
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
