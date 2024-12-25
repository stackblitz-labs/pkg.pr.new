<script lang="ts" setup>
definePageMeta({
  name: 'home',
})
</script>

<template>
  <div class="flex flex-col items-center gap-4 md:gap-12">
    <img src="/favicon.svg" alt="logo" width="64" height="64">

    <RepoSearch />

    <p class="text-center">
      Setup continuous releases with <a href="https://github.com/stackblitz-labs/pkg.pr.new" target="_blank" class="text-primary">pkg.pr.new</a> on your repository.
    </p>
  </div>
</template>
