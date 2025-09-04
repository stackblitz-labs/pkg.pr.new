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
const logoBase64 = ref<string>("");

const baseUrl = ref("https://pkg.pr.new");

onMounted(async () => {
  baseUrl.value = window.location.origin;

  try {
    const response = await fetch("/pkg-pr-new-logo.svg");
    if (!response.ok) throw new Error("Failed to fetch logo");
    const logoSvg = await response.text();
    logoBase64.value = btoa(logoSvg);
  } catch (error) {
    console.error("Failed to load logo:", error);
    logoBase64.value = btoa(
      '<svg width="71" height="73"><rect width="71" height="73" fill="#999"/></svg>',
    );
  }
});

const badgeUrl = computed(() => {
  if (!logoBase64.value) return "";

  return (
    `https://img.shields.io/static/v1?` +
    `label=&message=${encodeURIComponent(`${props.releaseCount} | pkg.pr.new`)}` +
    `&color=${color}` +
    `&style=${style}` +
    `&logo=data:image/svg+xml;base64,${logoBase64.value}` +
    `&logoSize=auto`
  );
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
        v-if="badgeUrl"
        :src="badgeUrl"
        :alt="`pkg.pr.new badge`"
        class="h-5 w-auto block max-w-none"
      />
      <div
        v-else
        class="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
      ></div>
    </a>

    <UButton
      @click="copyBadgeCode"
      size="xs"
      color="neutral"
      :icon="copied ? 'i-ph-check-bold' : 'i-ph-copy'"
      variant="ghost"
      class="!p-1 cursor-pointer"
      :disabled="!badgeUrl"
    />
  </div>
</template>
