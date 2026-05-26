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
    class="w-full"
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

    <div class="font-mono">
      <span>{{ owner }}</span>
      <span class="opacity-50">/</span>
      <span>{{ name }}</span>
    </div>
  </UButton>
</template>
