<script lang="ts" setup>
definePageMeta({
  name: "home",
  mainClass: "",
});

const gettingStartedEl = useTemplateRef("getting-started");

function scrollToGettingStarted() {
  gettingStartedEl.value?.scrollIntoView({
    behavior: "smooth",
  });
}
</script>

<template>
  <div>
    <div class="flex justify-center pt-4 pb-2">
      <a
        href="https://blog.stackblitz.com/posts/cloudflare-backing-pkg-pr-new-data-infrastructure/"
        target="_blank"
        class="bg-gray-900 dark:bg-gray-800 text-white rounded-full px-6 py-3 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 block relative overflow-hidden before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-0 before:h-0.5 before:bg-gradient-to-r before:from-orange-400 before:to-blue-400 before:rounded-full before:transition-all before:duration-500 hover:before:w-16"
      >
        <div class="flex items-center gap-3 text-sm">
          <div class="flex items-center gap-2">
            <span><strong>pkg.pr.new</strong> is now backed by</span>
            <img
              src="/cloudflare-icon.svg"
              alt="Cloudflare"
              width="18"
              height="18"
              class="inline-block"
            />
            <span class="font-semibold text-orange-400">Cloudflare</span>
          </div>
          <UIcon name="ph-arrow-right" class="text-gray-400" />
        </div>
      </a>
    </div>

    <div
      class="my-container flex flex-col items-center gap-4 md:gap-12 min-h-[calc(100vh-80px)]"
    >
      <img src="/favicon.svg" alt="logo" width="64" height="64" />

      <RepoSearch />

      <div class="flex-1" />

      <div
        class="flex flex-col items-center gap-2"
        @click.prevent="scrollToGettingStarted()"
      >
        <div class="text-center">
          Scroll to setup continuous releases with
          <a
            href="https://github.com/stackblitz-labs/pkg.pr.new"
            target="_blank"
            class="text-primary-500"
            >pkg.pr.new</a
          >
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

    <div
      ref="getting-started"
      class="min-h-screen p-6 flex items-center bg-gray-100 dark:bg-gray-800"
    >
      <GettingStarted id="getting-started" class="my-container" />
    </div>
  </div>
</template>
