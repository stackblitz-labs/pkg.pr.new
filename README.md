
<p align="center"><img src="https://github.com/stackblitz-labs/stackblitz-ci/assets/37929992/3f37601d-1963-4038-a822-97ef056be667" /></p>

# Continuous Releases <span><img src="https://emoji.slack-edge.com/TFHDVN56F/stackblitz/fd010078dcccebca.png" width="30" /></span>

With Stackblitz CR, each of your commits and pull-requests would trigger an instant build and a release. This enables users to access features and bug-fixes without the need to wait for release cycles using npm or pull-request merges. 

- 🚀 Instant Builds
- 🛠️ Github Workflows Friendly
- 📦️ No Configuration
- 🔩 Single Command
- ✉️ Pull Request Comments
- 🔥 Check Runs

CR is aiming to reduce the number of these comments :) 

> This was fixed in #18. Can we release that fix?

> Will ask the maintainer to release ;)

## Setup

The Github Application is available [here](https://github.com/apps/stackblitz-cr).

After installing on your repository, you can run `npx stackblitz-cr pulibsh` with `GITHUB_TOKEN` in your workflows and then you have continuous releases!  

```sh
npm install --save-dev stackblitz-cr
```

<img width="100%" src="https://github.com/stackblitz-labs/stackblitz-ci/assets/37929992/1ec45036-ebfb-4f6d-812b-1b8fdade2c62" />

### Examples

- Release each commit and pull request:

```yml
name: Publish Any Commit
on: [push, pull_reuqest]

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

    - run: pnpm sb publish # or pnpm stackblitz-cr publish 
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} # GITHUB_TOKEN is provided automatically in any repository
```

- Release approved pull requests only:
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

    - run: pnpm sb publish 
      env:
        GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> Releasing approved pull requests is the recommended way of having continuous releases. This ensures users always install approved and safe packages. 

Publishing is only available in workflows and it supports any workflow trigger event, more information [here](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#about-events-that-trigger-workflows).

<p align="center"><img src="https://github.com/stackblitz-labs/stackblitz-ci/assets/37929992/ede770a3-a911-4e24-99d6-cd307b44fd87" /></p>


