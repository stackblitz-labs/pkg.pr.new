<script lang="ts" setup>
defineProps<{
  step: number | string;
}>();
</script>

<template>
  <div class="@container/step w-full min-w-0">
    <div
      class="p-4 rounded-xl border border-primary-300 bg-primary-100 dark:bg-primary-900/5 dark:border-primary-900 w-full min-w-0 flex flex-col gap-4 @md/step:p-6 @md/step:flex-row @md/step:gap-6"
    >
      <div
        class="text-2xl size-14 rounded-full bg-primary-500/20 dark:bg-primary-900/20 flex items-center justify-center flex-none self-start text-primary-500 font-mono @md/step:text-4xl @md/step:size-20"
      >
        {{ step }}
      </div>

      <div class="flex min-w-0 w-full flex-col gap-4 @md/step:gap-6">
        <slot />

        <div
          v-if="$slots.actions"
          class="flex w-full min-w-0 flex-col items-stretch gap-2 @md/step:items-start"
        >
          <slot name="actions" />
        </div>
      </div>
    </div>
  </div>
</template>
