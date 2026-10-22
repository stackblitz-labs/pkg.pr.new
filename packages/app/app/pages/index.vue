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
    <div class="flex justify-center px-4 pt-4 pb-2">
      <a
        href="https://blog.stackblitz.com/posts/cloudflare-backing-pkg-pr-new-data-infrastructure/"
        target="_blank"
        class="bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white rounded-full px-3 py-2 sm:px-5 sm:py-2.5 block w-fit max-w-full border border-gray-200 dark:border-gray-700"
      >
        <div
          class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-center"
        >
          <span class="min-w-0"
            ><strong>pkg.pr.new</strong> is now backed by</span
          >
          <img
            src="/cloudflare-icon.svg"
            alt="Cloudflare"
            width="18"
            height="18"
            class="inline-block shrink-0"
          />
          <span class="font-semibold text-orange-500 dark:text-orange-400"
            >Cloudflare</span
          >
        </div>
      </a>
    </div>

    <div
      class="my-container flex flex-col items-center gap-4 md:gap-12 min-h-[calc(100svh-11rem)] lg:min-h-[calc(100vh-80px)]"
    >
      <img src="/favicon.svg" alt="logo" width="64" height="64" />

      <RepoSearch />

      <div class="flex-1" />

      <div
        class="flex flex-col items-center gap-2"
        @click.prevent="scrollToGettingStarted()"
      >
        <div class="text-center text-balance max-w-full px-2">
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
      class="min-h-dvh lg:min-h-screen p-4 sm:p-6 flex items-center bg-gray-100 dark:bg-gray-800"
    >
      <GettingStarted id="getting-started" class="my-container" />
    </div>
  </div>
</template>
