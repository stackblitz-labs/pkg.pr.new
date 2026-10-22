<script lang="ts" setup>
const props = defineProps<{
  code: string;
}>();

const { copy, isSupported } = useClipboard();

const toast = useToast();

function copyCode() {
  copy(props.code);
  toast.add({
    title: "Copied to clipboard",
    color: "success",
    icon: "ph-check",
  });
}
</script>

<template>
  <div class="relative min-w-0 max-w-full">
    <pre
      class="text-white bg-gray-500 dark:bg-black rounded-lg py-4 pr-14 pl-4 sm:py-6 sm:pr-16 sm:pl-6 overflow-x-auto overscroll-x-contain max-w-full"
    ><code class="whitespace-pre">{{ props.code }}</code></pre>

    <div class="absolute top-2 right-2">
      <ClientOnly>
        <UTooltip v-if="isSupported" text="Copy to clipboard">
          <UButton
            icon="ph-clipboard"
            aria-label="Copy to clipboard"
            @click="copyCode"
          />
        </UTooltip>
      </ClientOnly>
    </div>
  </div>
</template>
