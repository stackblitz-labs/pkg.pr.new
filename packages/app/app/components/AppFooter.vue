<template>
  <footer
    class="text-center p-12 opacity-100 dark:opacity-50 dark:hover:opacity-100 dark:focus-within:opacity-100 flex flex-col items-center gap-3 text-xs transition-opacity duration-200"
  >
    <div class="flex gap-6 items-center justify-center">
      <div class="flex items-center">
        <a href="https://stackblitz.com/" target="_blank" class="block">
          <img
            src="/stackblitz.svg"
            alt="StackBlitz"
            width="117"
            height="28"
            class="not-dark:hidden"
          />
          <img
            src="/stackblitz-black.svg"
            alt="StackBlitz"
            width="117"
            height="28"
            class="dark:hidden"
          />
        </a>
      </div>
      <div class="text-xs opacity-70 flex items-center">+</div>
      <div class="flex items-center">
        <a href="https://cloudflare.com/" target="_blank" class="block">
          <img
            src="/cloudflare.svg"
            alt="Cloudflare"
            width="120"
            height="24"
            class="pb-1"
          />
        </a>
      </div>
    </div>

    <div class="flex gap-3 items-center">
      <div>
        Built in
        <a
          href="https://github.com/stackblitz-labs"
          target="_blank"
          class="text-primary"
          >StackBlitz Labs</a
        >
      </div>
      <UIcon name="ph-dot" />
      <div>
        <a
          href="https://blog.stackblitz.com/posts/cloudflare-backing-pkg-pr-new-data-infrastructure/"
          target="_blank"
          class="text-primary"
          >Backed by Cloudflare</a
        >
      </div>
      <UIcon name="ph-dot" />
      <div>
        UI by
        <a href="https://github.com/Akryum" target="_blank" class="text-primary"
          >Akryum</a
        >
      </div>
    </div>
  </footer>
</template>
