<p align="center"><img src="https://github.com/stackblitz-labs/pkg.pr.new/assets/37929992/ade1bc5d-1b76-43d1-a74a-7b2f5882f331" /></p>

# pkg.pr.new <span><img src="https://emoji.slack-edge.com/TFHDVN56F/stackblitz/fd010078dcccebca.png" width="30" /></span>

> We call it "Continuous Releases" too.

With pkg.pr.new, each of your commits and pull requests will trigger an instant preview release without publishing anything to NPM. This enables users to access features and bug-fixes without the need to wait for release cycles using npm or pull request merges.

- 🚀 Instant Builds
- 🍕 No Need for NPM Access
- 🛠️ Github Workflows Friendly
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

## Setup

The Github Application is available [here](https://github.com/apps/pkg-pr-new).

> [!IMPORTANT]
> Make sure it's installed on the repository before trying to publish a package.

After installing on your repository, you can run `npx pkg-pr-new publish` in your workflows and then you have continuous releases!

```sh
npm install --save-dev pkg-pr-new # or `npx pkg-pr-new publish`
```

For workspaces:

```sh
npx pkg-pr-new publish './packages/A' './packages/B' # or `npx pkg-pr-new publish './packages/*'`
```

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

> `--compact` requires your package to be a valid (published) package on npm with a specified `repository` field in the package.json! See [this](https://docs.npmjs.com/cli/v7/configuring-npm/package-json#repository). pkg.pr.new is case sensitive, if the Github owner is `PuruVJ`, the package.json `repository` field should not have `puruvj`. 

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
        uses: actions/checkout@v2

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
  approved:
    if: github.event.review.state == 'APPROVED'
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - run: corepack enable
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - run: pnpx pkg-pr-new publish
```

#### Avoid publishing on tags

```yml
on:
  pull_request:
  push:
    branches:
      - '**'
    tags:
      - '!**'
```
As noted in [#140](https://github.com/stackblitz-labs/pkg.pr.new/issues/140), workflows run on tags too, that's not an issue at all, but in case users would like to avoid duplicate publishes.

---

> Releasing approved pull requests is the recommended way of having continuous releases. This ensures users always install approved and safe packages.

Publishing is only available in workflows and it supports any workflow trigger event, more information [here](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#about-events-that-trigger-workflows).

<p align="center"><img src="https://github.com/stackblitz-labs/pkg.pr.new/assets/37929992/e15abdc6-aaeb-4895-b2e9-0b73a019c1d0" /></p>
