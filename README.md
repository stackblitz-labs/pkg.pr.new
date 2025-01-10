<p align="center"><img src="https://github.com/user-attachments/assets/314d5112-f67f-4758-82bf-7b0c19c01ba6" /></p>

# pkg.pr.new <span><img src="https://emoji.slack-edge.com/TFHDVN56F/stackblitz/fd010078dcccebca.png" width="30" /></span>

> We call it "Continuous Releases" too.

With pkg.pr.new, each of your commits and pull requests will trigger an instant preview release without publishing anything to NPM. This enables users to access features and bug-fixes without the need to wait for release cycles using npm or pull request merges.

- 🚀 Instant Builds
- 🍕 No Need for NPM Access
- 🛠️ GitHub Workflows Friendly
- 📦️ No Configuration
- 🔩 Single Command
- ✉️ Pull Request Comments
- 🔥 Check Runs

pkg.pr.new won't publish anything to NPM; instead, it leverages its own URLs, which are npm-compatible.

```sh
npm i https://pkg.pr.new/tinylibs/tinybench/tinybench@a832a55

# npm i https://pkg.pr.new/${owner}/${repo}/${package}@{commit}
```

It is aiming to reduce the number of these comments :)

> This was fixed in #18. Can we release that fix?

These are some of the projects and companies using pkg.pr.new:

<p align="center">
  <a href="https://trigger.dev/"><img src="https://trigger.dev/assets/triggerdev-logo--with-border.svg" height="40"></a>
  <a href="https://vuejs.org/"><img src="https://vuejs.org/images/logo.png" height="40"></a>
  <a href="https://huggingface.co/"><img src="https://huggingface.co/front/assets/huggingface_logo.svg" height="40"></a>
  <a href="https://about.meta.com/"><img src="https://github.com/facebook.png" height="40"></a>
  <a href="https://nuxt.com/"><img src="https://nuxt.com/assets/design-kit/icon-green.png" height="40"></a>
  <a href="https://vitejs.dev/"><img src="https://vitejs.dev/logo.svg" height="40"></a>
  <a href="https://vitest.dev/"><img src="https://vitest.dev/logo.svg" height="40"></a>
  <a href="https://github.com/volarjs"><img src="https://github.com/volarjs.png" height="40"></a>
  <a href="https://qwik.builder.io/"><img src="https://qwik.builder.io/logos/qwik-logo.svg" height="40"></a>
  <a href="https://qwikui.com/"><img src="https://qwikui.com/favicon.svg" height="40"></a>
  <a href="https://tanstack.com/"><img src="https://avatars.githubusercontent.com/u/72518640?s=200&v=4" height="40"></a>
  <a href="https://biomejs.dev/"><img src="https://github.com/biomejs.png" height="40"></a>
  <a href="https://github.com/tinylibs"><img src="https://github.com/tinylibs.png" height="40"></a>
  <a href="https://unjs.io/"><img src="https://avatars.githubusercontent.com/u/80154025?s=200&v=4" height="40"></a>
  <a href="https://www.radix-vue.com/"><img src="https://www.radix-vue.com/logo.svg" height="40"></a>
  <a href="https://www.gradio.app/"><img src="https://www.gradio.app/_app/immutable/assets/gradio.CHB5adID.svg" height="40"></a>
  <a href="https://clockworklabs.io/"><img src="https://github.com/user-attachments/assets/85d42291-6676-4592-b6a0-ee4b6350dc47" height="40"></a>
  <a href="https://valtio.pmnd.rs/"><img src="https://blog.stackblitz.com/posts/pkg-pr-new/valtio.svg" height="40"></a>
  <a href="https://github.com/nksaraf/vinxi"><img src="https://github.com/nksaraf/vinxi/raw/main/docs/public/logo.png" height="40"></a>
  <a href="https://github.com/scalar/scalar"><img src="https://github.com/scalar.png" height="40"></a>
  <a href="https://tresjs.org/"><img src="https://avatars.githubusercontent.com/u/119253150?s=200&v=4" height="40"></a>
  <a href="https://github.com/capawesome-team/"><img src="https://avatars.githubusercontent.com/u/105555861?s=200&v=4" height="40"></a>
  <a href="https://unocss.dev"><img src="https://unocss.dev/logo.svg" height="40"></a>
  <a href="https://github.com/kazupon/vue-i18n">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/intlify/art/master/logo_symbol_negative.svg" height="40" />
        <img height="40" src="https://raw.githubusercontent.com/intlify/art/master/logo_symbol.svg">
    </picture>
  </a>
  <a href="https://github.com/vite-pwa">
    <picture>
        <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/vite-pwa/.github/main/hero-dark.svg" height="40" />
        <img height="40" src="https://raw.githubusercontent.com/vite-pwa/.github/main/hero-light.svg">
    </picture>
  </a>
   <a href="https://github.com/forge42dev/open-source-stack"><img src="https://avatars.githubusercontent.com/u/161314831?s=200&v=4" height="40"></a>
   <a href="https://sidebase.io"><img src="https://avatars.githubusercontent.com/u/112630501?s=200&v=4" height="40"></a>
   <a href="https://rolldown.rs/"><img src="https://avatars.githubusercontent.com/u/94954945" height="40"></a>
   <a href="https://element-plus.org/"><img src="https://avatars.githubusercontent.com/u/68583457?s=48&v=4" height="40"></a>
   <a href="https://valibot.dev/"><img src="https://raw.githubusercontent.com/fabian-hiller/valibot/main/brand/valibot-icon.svg" height="40"></a>
   <a href="https://codemod.com/"><img src="https://github.com/codemod-com.png" height="40"></a>
   <a href="https://uploadthing.com/"><img src="https://uploadthing.com/UploadThing-Logo.svg" height="40"></a>
   <a href="https://nuqs.47ng.com"><img src="https://raw.githubusercontent.com/47ng/nuqs/e65560b518e5b60500ea28e59ce55bdb2079fcda/packages/docs/src/app/icon.svg" height="40"></a>
   <a href="https://github.com/nuxt-modules/i18n"><img height="40" src="https://raw.githubusercontent.com/nuxt-modules/i18n/main/docs/public/icon.svg"></a>
   <a href="https://github.com/codiume/orbit"><img height="40" src="https://avatars.githubusercontent.com/u/98262232"></a>
   <a href="https://vue-mess-detector.webmania.cc"><img src="https://vue-mess-detector.webmania.cc/logo.png" alt="Vue Mess Detector Logo" height="40" /></a>
   <a href="https://wxt.dev/"><img src="https://raw.githubusercontent.com/wxt-dev/wxt/HEAD/docs/public/hero-logo.svg" alt="WXT Framework Logo" height="40" /></a>
   <a href="https://rspack.dev/"><img src="https://assets.rspack.dev/rspack/rspack-logo.svg" height="40"></a>
   <a href="https://kermanx.github.io/reactive-vscode/"><img src="https://kermanx.github.io/reactive-vscode/logo.svg" height="40"></a>
   <a href="https://fast-check.dev/"><img src="https://raw.githubusercontent.com/dubzzz/fast-check/252853fa2984d7f1a060d92423ffd6603735c086/website/static/img/mug.svg" height="40"></a>
   <a href="https://svelte.dev"><img src="https://svelte.dev/favicon.png" height="40" /></a>
   <a href="https://trpc.io"><img src="https://trpc.io/img/logo.svg" height="40" /></a>
   <a href="https://kysely.dev"><img src="https://kysely.dev/img/logo.svg" height="40" /></a>
   <a href="https://tutorialkit.dev/"><img src="https://raw.githubusercontent.com/stackblitz/tutorialkit/refs/tags/1.3.0/extensions/vscode/resources/tutorialkit-icon.png" height="40" /></a>
   <a href="https://heyapi.dev"><img src="https://heyapi.dev/images/logo-300w.png" height="40" /></a>
</p>

Feel free to add your project or company here to join the pkg.pr.new family :)

You can also join our discord server [here](https://discord.gg/stackblitz), so we all have fun together!

## Setup

First [install the GitHub Application](https://github.com/apps/pkg-pr-new).

> [!IMPORTANT]
> Make sure it's installed on the repository before trying to publish a package. To read about the permissions the app needs, check [#305](https://github.com/stackblitz-labs/pkg.pr.new/issues/305).

After installing on your repository, you can run `npx pkg-pr-new publish` in your workflows and then you have continuous releases!

```sh
npm install --save-dev pkg-pr-new # or `npx pkg-pr-new publish`
```

For workspaces and monorepos:

```sh
npx pkg-pr-new publish './packages/A' './packages/B' # or `npx pkg-pr-new publish './packages/*'`
```

> [!IMPORTANT]
> Make sure the pkg-pr-new command runs only once in a defined workflow (that's part of how it avoids spam)! So instead of multiple times running pkg-pr-new for each workspace package, the command should be run one time for all the desired packages using the pattern above.

For templates (experimental):

> [!NOTE]
> With templates, pkg.pr.new will generate Stackblitz instances for the given directories with the new built packages.

```sh
npx pkg-pr-new publish './packages/A' --template './examples/*'
```

By default, pkg.pr.new will generate a template called "default" which includes each built package in the dependencies. This can be disabled with `--no-template`.

For shorter urls, `--compact` can be useful:

```sh
npx pkg-pr-new publish --compact './packages/A' './packages/B'
```

> `--compact` requires your package to be a valid (published) package on npm with a specified `repository` field in the package.json! See [this](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#repository). pkg.pr.new is case sensitive, if the GitHub owner is `PuruVJ`, the package.json `repository` field should not have `puruvj`.

With `--compact`:

```sh
npm i https://pkg.pr.new/tinybench@a832a55
```

Without `--compact`:

```sh
npm i https://pkg.pr.new/tinylibs/tinybench/tinybench@a832a55
```

You can control publishing comments with `--comment`:

```sh
npx pkg-pr-new publish --comment=update # default
```

Using `--comment=update`, pkg.pr.new would generate one initial comment and then edit it in the following commits.

With `--comment=create`, each commit would generate a comment for itself, useful for triggering workflows, like workflow execution using maintainer comments.

And `--comment=off` would turn off comments for maintainers who prefer minimal pull requests.

To customize which package manager is reflected in the comments, use the `--packageManager=XYZ` flag. XYZ can be one of the following: npm (default), pnpm, yarn, or bun.

For repositories with many packages, comments might get too long. In that case, you can use `--only-templates` to only show templates.

pkg.pr.new uses `npm pack --json` under the hood, in case you face issues, you can also use the `--pnpm` flag so it starts using `pnpm pack`. This is not necessary in most cases.

<img width="100%" src="https://github.com/stackblitz-labs/pkg.pr.new/assets/37929992/2fc03b94-ebae-4c47-a271-03a4ad5d2449" />

pkg.pr.new is not available in your local environment and it only works in workflows.

### Examples

#### Release each commit and pull request:

```yml
name: Publish Any Commit
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - run: corepack enable
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build

      - run: pnpx pkg-pr-new publish
```

#### Release approved pull requests only:

```yml
name: Publish Approved Pull Requests
on:
  pull_request_review:
    types: [submitted]

jobs:
  check:
    # First, trigger a permissions check on the user approving the pull request.
    if: github.event.review.state == 'approved'
    runs-on: ubuntu-latest
    outputs:
      has-permissions: ${{ steps.checkPermissions.outputs.require-result }}
    steps:
      - name: Check permissions
        id: checkPermissions
        uses: actions-cool/check-user-permission@v2
        with:
          # In this example, the approver must have the write access
          # to the repository to trigger the package preview.
          require: "write"

  publish:
    needs: check
    # Publish the preview package only if the permissions check passed.
    if: needs.check.outputs.has-permissions == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - run: corepack enable
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - run: pnpx pkg-pr-new publish
```

> Releasing approved pull requests is the recommended way of having continuous releases. This ensures users always install approved and safe packages.

> [!TIP]
> For any in-repo branch not yet opened as a pull request, if pkg.pr.new has already run on it, a `@branch-name` tag will link to the latest commit. <br/> Example: http://pkg.pr.new/vite@main

#### Avoid publishing on tags

```yml
on:
  pull_request:
  push:
    branches:
      - "**"
    tags:
      - "!**"
```

As noted in [#140](https://github.com/stackblitz-labs/pkg.pr.new/issues/140), workflows run on tags too, that's not an issue at all, but in case users would like to avoid duplicate publishes.

## Custom GitHub Messages and Comments

For advanced use cases where you want more control over the messages posted by pkg.pr.new, you can use the `--json` option in combination with `--comment=off`. This allows you to generate metadata about the publish operation without creating a default comment, which you can then use to create custom comments via the GitHub Actions API.

### Steps:

1. Use pkg.pr.new with the `--json` and `--comment=off` options in your workflow:

```yml
- name: Publish packages
  run: npx pkg-pr-new publish --json output.json --comment=off
```

2. Add a custom step in your workflow to process the JSON output and create a custom comment:

```yml
- name: Post or update comment
  uses: actions/github-script@v6
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    script: |
      const fs = require('fs');
      const output = JSON.parse(fs.readFileSync('output.json', 'utf8'));

      const packages = output.packages
        .map((p) => `- ${p.name}: ${p.url}`)
        .join('\n');
      const templates = output.templates
        .map((t) => `- [${t.name}](${t.url})`)
        .join('\n');

      const sha =
        context.event_name === 'pull_request'
          ? context.payload.pull_request.head.sha
          : context.payload.after;

      const commitUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/commit/${sha}`;

      const body = `## Custom Publish Message

      ### Published Packages:

      ${packages}

      ### Templates:

      ${templates}

      [View Commit](${commitUrl})`;

      const botCommentIdentifier = '## Custom Publish Message';

      async function findBotComment(issueNumber) {
        if (!issueNumber) return null;
        const comments = await github.rest.issues.listComments({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: issueNumber,
        });
        return comments.data.find((comment) =>
          comment.body.includes(botCommentIdentifier)
        );
      }

      async function createOrUpdateComment(issueNumber) {
        if (!issueNumber) {
          console.log('No issue number provided. Cannot post or update comment.');
          return;
        }

        const existingComment = await findBotComment(issueNumber);
        if (existingComment) {
          await github.rest.issues.updateComment({
            owner: context.repo.owner,
            repo: context.repo.repo,
            comment_id: existingComment.id,
            body: body,
          });
        } else {
          await github.rest.issues.createComment({
            issue_number: issueNumber,
            owner: context.repo.owner,
            repo: context.repo.repo,
            body: body,
          });
        }
      }

      async function logPublishInfo() {
        console.log('\n' + '='.repeat(50));
        console.log('Publish Information');
        console.log('='.repeat(50));
        console.log('\nPublished Packages:');
        console.log(packages);
        console.log('\nTemplates:');
        console.log(templates);
        console.log(`\nCommit URL: ${commitUrl}`);
        console.log('\n' + '='.repeat(50));
      }

      if (context.eventName === 'pull_request') {
        if (context.issue.number) {
          await createOrUpdateComment(context.issue.number);
        }
      } else if (context.eventName === 'push') {
        const pullRequests = await github.rest.pulls.list({
          owner: context.repo.owner,
          repo: context.repo.repo,
          state: 'open',
          head: `${context.repo.owner}:${context.ref.replace(
            'refs/heads/',
            ''
          )}`,
        });

        if (pullRequests.data.length > 0) {
          await createOrUpdateComment(pullRequests.data[0].number);
        } else {
          console.log(
            'No open pull request found for this push. Logging publish information to console:'
          );
          await logPublishInfo();
        }
      }
```

This custom script does the following:

- For pull requests: It creates or updates a comment with the publish information.
- For pushes with an associated open PR: It adds or updates a comment on that PR.
- For pushes without an open PR (e.g., direct pushes to main): It logs the publish information to the GitHub Actions console.

This is a sample recipe that users can adapt with `--json` and `--comment=off` to create custom comments.

This custom approach gives you full control over how pkg.pr.new communicates its results.

---

Publishing is only available in workflows and it supports any workflow trigger event, more information [here](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#about-events-that-trigger-workflows).

<p align="center"><img src="https://github.com/stackblitz-labs/pkg.pr.new/assets/37929992/e15abdc6-aaeb-4895-b2e9-0b73a019c1d0" /></p>
