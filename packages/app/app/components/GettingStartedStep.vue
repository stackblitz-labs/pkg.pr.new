<script lang="ts" setup>
defineProps<{
  step: number | string
}>()
</script>

<template>
  <div class="p-6 rounded-xl border border-primary-300 bg-primary-100 dark:bg-primary-900/5 dark:border-primary-900 w-full flex gap-6">
    <div class="text-4xl size-20 rounded-full bg-primary-500/20 dark:bg-primary-900/20 flex items-center justify-center flex-none text-primary-500 font-mono">
      {{ step }}
    </div>

    <div class="flex flex-col gap-6">
      <slot />

      <div v-if="$slots.actions" class="flex flex-col items-start gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
