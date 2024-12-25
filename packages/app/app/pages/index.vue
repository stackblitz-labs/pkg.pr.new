<script lang="ts" setup>
definePageMeta({
  name: 'home',
  mainClass: '',
})

const gettingStartedEl = useTemplateRef('getting-started')

function scrollToGettingStarted() {
  gettingStartedEl.value?.scrollIntoView({
    behavior: 'smooth',
  })
}
</script>

<template>
  <div>
    <div class="my-container flex flex-col items-center gap-4 md:gap-12 min-h-[calc(100vh-80px)]">
      <img src="/favicon.svg" alt="logo" width="64" height="64">

      <RepoSearch />

      <div class="flex-1" />

      <div class="flex flex-col items-center gap-2" @click.prevent="scrollToGettingStarted()">
        <div class="text-center">
          Scroll to setup continuous releases with <a href="https://github.com/stackblitz-labs/pkg.pr.new" target="_blank" class="text-primary-500">pkg.pr.new</a>
        </div>

        <div class="flex flex-col mt-2">
          <UIcon
            v-for="n in 3"
            :key="n"
            name="ph-caret-down"
            class="text-primary-500 animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite] -mt-2"
            :style="{
              animationDelay: `${n * 0.25}s`,
            }"
          />
        </div>
      </div>
    </div>

    <div ref="getting-started" class="min-h-screen p-6 flex items-center bg-gray-800">
      <GettingStarted id="getting-started" class="my-container" />
    </div>
  </div>
</template>
