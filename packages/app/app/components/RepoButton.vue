<script lang="ts" setup>
defineProps<{
  owner: string
  name: string
  avatar?: string
}>()
</script>

<template>
  <UButton
    :to="{
      name: 'repo:details',
      params: {
        owner,
        repo: name,
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
    />

    <div class="font-mono">
      <span>{{ owner }}</span>
      <span class="opacity-50">/</span>
      <span>{{ name }}</span>
    </div>
  </UButton>
</template>
