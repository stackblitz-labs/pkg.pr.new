<script lang="ts" setup>

</script>

<template>
  <div class="flex flex-col gap-6">
    <GettingStartedStep step="1">
      First, install the GitHub application on your repositories.

      <template #actions>
        <UButton
          href="https://github.com/apps/pkg-pr-new"
          target="_blank"
          icon="mdi-github"
          trailing-icon="ph-arrow-square-out"
        >
          Install GitHub App
        </UButton>
      </template>
    </GettingStartedStep>

    <GettingStartedStep step="2">
      <div>
        Then, use the following command in your workflows to create continuous releases.
      </div>

      <CodeSnippet code="npx pkg-pr-new publish" />

      <template #actions>
        <UButton
          href="https://github.com/stackblitz-labs/pkg.pr.new?tab=readme-ov-file#examples"
          target="_blank"
          icon="ph-code-block"
          trailing-icon="ph-arrow-square-out"
        >
          See Workflow examples
        </UButton>

        <UButton
          href="https://github.com/stackblitz-labs/pkg.pr.new?tab=readme-ov-file#setup"
          target="_blank"
          icon="ph-notebook"
          trailing-icon="ph-arrow-square-out"
        >
          Learn more about pkg.pr.new setup
        </UButton>
      </template>
    </GettingStartedStep>

    <GettingStartedStep step="3">
      <div>
        Done! Enjoy continuous releases on your Pull Requests!
      </div>

      <img src="/pr-screenshot.png" alt="PR Screenshot" class="rounded-lg">
    </GettingStartedStep>
  </div>
</template>
