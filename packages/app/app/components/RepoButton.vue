<script lang="ts" setup>
defineProps<{
  owner: string;
  name: string;
  avatar?: string;
  withDev?: boolean;
}>();
</script>

<template>
  <UButton
    :to="{
      name: 'repo:details',
      params: {
        owner,
        repo: name,
        withDev: String(!!withDev),
      },
    }"
    class="w-full min-w-0"
    :ui="{ base: 'min-w-0' }"
    size="lg"
    color="neutral"
    variant="ghost"
  >
    <UAvatar
      :src="avatar"
      :alt="name"
      size="sm"
      :ui="{
        root: 'rounded-md',
        image: 'rounded-md',
      }"
    />

    <div class="font-mono truncate min-w-0 text-left">
      <span>{{ owner }}</span>
      <span class="opacity-50">/</span>
      <span>{{ name }}</span>
    </div>
  </UButton>
</template>
