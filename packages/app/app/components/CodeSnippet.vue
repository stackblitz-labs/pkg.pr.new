<script lang="ts" setup>
const props = defineProps<{
  code: string
}>()

const { copy, isSupported } = useClipboard()

const toast = useToast()

function copyCode() {
  copy(props.code)
  toast.add({
    title: 'Copied to clipboard',
    color: 'success',
    icon: 'ph-check',
  })
}
</script>

<template>
  <div class="relative group">
    <pre class="text-white bg-gray-500 dark:bg-black rounded-lg p-6"><code>{{ props.code }}</code></pre>

    <ClientOnly>
      <UTooltip
        v-if="isSupported"
        text="Copy to clipboard"
      >
        <UButton
          icon="ph-clipboard"
          class="absolute top-2 right-2 not-group-hover:hidden"
          @click="copyCode"
        />
      </UTooltip>
    </ClientOnly>
  </div>
</template>
