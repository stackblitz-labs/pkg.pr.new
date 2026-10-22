<script lang="ts" setup></script>

<template>
  <div class="flex flex-col gap-6 min-w-0 w-full">
    <GettingStartedStep step="1">
      First, install the GitHub application on your repositories.

      <template #actions>
        <UButton
          href="https://github.com/apps/pkg-pr-new"
          target="_blank"
          icon="mdi-github"
          trailing-icon="ph-arrow-square-out"
          class="max-w-full whitespace-normal! h-auto text-left @max-md/step:w-full"
        >
          Install GitHub App
        </UButton>
      </template>
    </GettingStartedStep>

    <GettingStartedStep step="2">
      <div>
        Then, use the following command in your workflows to create continuous
        releases.
      </div>

      <CodeSnippet code="pnpm exec pkg-pr-new publish" />

      <template #actions>
        <UButton
          href="https://github.com/stackblitz-labs/pkg.pr.new?tab=readme-ov-file#examples"
          target="_blank"
          icon="ph-code-block"
          trailing-icon="ph-arrow-square-out"
          class="max-w-full whitespace-normal! h-auto text-left @max-md/step:w-full"
        >
          See Workflow examples
        </UButton>

        <UButton
          href="https://github.com/stackblitz-labs/pkg.pr.new?tab=readme-ov-file#setup"
          target="_blank"
          icon="ph-notebook"
          trailing-icon="ph-arrow-square-out"
          class="max-w-full whitespace-normal! h-auto text-left @max-md/step:w-full"
        >
          Learn more about pkg.pr.new setup
        </UButton>
      </template>
    </GettingStartedStep>

    <GettingStartedStep step="3">
      <div>Done! Enjoy continuous releases on your Pull Requests!</div>

      <img
        src="/pr-screenshot.png"
        alt="PR Screenshot"
        class="rounded-lg max-w-full h-auto"
      />
    </GettingStartedStep>

    <GettingStartedStep step="4">
      <div>Promote pkg.pr.new by adding a badge to your repository README:</div>

      <div class="w-full max-w-[550px] min-w-0">
        <CodeSnippet
          class="text-xs lg:text-[10px]"
          code="[![pkg.pr.new](https://pkg.pr.new/badge/OWNER/REPO)](https://pkg.pr.new/~/OWNER/REPO)"
        />
      </div>

      <div class="text-gray-500 text-sm">
        Replace OWNER and REPO with your GitHub username/organization and
        repository name.
      </div>

      <template #actions>
        <UButton
          href="https://github.com/stackblitz-labs/pkg.pr.new?tab=readme-ov-file#badge"
          target="_blank"
          icon="ph-badge"
          trailing-icon="ph-arrow-square-out"
          class="max-w-full whitespace-normal! h-auto text-left @max-md/step:w-full"
        >
          Learn more about badge options
        </UButton>
      </template>
    </GettingStartedStep>
  </div>
</template>
