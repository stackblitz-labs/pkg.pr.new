# pkg.pr.new

## Setup

Make sure to install the dependencies with [pnpm](https://pnpm.io/installation#using-corepack):

```bash
pnpm install
```

Copy the `.env.example` file to `.env` and fill in your GitHub token:

```bash
cp .env.example .env
```

Create a GitHub token with no special scope on [GitHub](https://github.com/settings/personal-access-tokens/new) and set it in the `.env` file:

```bash
NUXT_GITHUB_TOKEN=your-github-token
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
pnpm dev
```

## Production

Build the application for production:

```bash
pnpm build
```
