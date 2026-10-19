# Tooling templates

Drop-in scaffolding for Phase 1. Adapt paths and package names to the project. Replace
`<app>` placeholders.

## biome.json

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.15/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignoreUnknown": true,
    "includes": [
      "**",
      "!node_modules",
      "!.next",
      "!dist",
      "!coverage",
      "!artifacts",
      "!.worktrees"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "preset": "recommended",
      "a11y": { "preset": "none" },
      "correctness": { "preset": "recommended", "noUnusedVariables": "error" },
      "suspicious": {
        "preset": "recommended",
        "noConsole": { "level": "warn", "options": { "allow": ["log", "error", "warn"] } }
      },
      "style": { "preset": "recommended", "useConst": "error" },
      "performance": { "preset": "none" }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "trailingCommas": "all",
      "semicolons": "always"
    }
  },
  "css": { "parser": { "tailwindDirectives": true }, "formatter": { "enabled": true } },
  "overrides": [
    {
      "includes": ["src/app/about/about-client.tsx"],
      "linter": { "rules": { "security": { "noDangerouslySetInnerHtml": "off" } } }
    },
    {
      "includes": ["scripts/check-comments.mjs"],
      "linter": { "rules": { "suspicious": { "noConsole": "off" } } }
    },
    {
      "includes": ["src/app/globals.css"],
      "linter": { "rules": { "complexity": { "noImportantStyles": "off" } } }
    }
  ]
}
```

## .husky/pre-commit

```
npx lint-staged
```

## package.json scripts + lint-staged

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check:comments": "node scripts/check-comments.mjs",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js,mjs,json,css}": [
      "biome check --write --no-errors-on-unmatched"
    ]
  }
}
```

For Vite apps, change `dev`/`build`/`start` accordingly; keep the quality scripts.

## .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm check:comments
      - run: pnpm test
      - run: pnpm build
```

If not using pnpm, drop `pnpm/action-setup` and `cache: pnpm`, and use `npm ci`.

## tsconfig.json (Next.js)

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "paths": { "@/*": ["./src/*"] },
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

## next.config.ts

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [] },
  experimental: {
    optimizePackageImports: ["lucide-react", "@tanstack/react-query"],
  },
};

export default nextConfig;
```

Add hostnames to `remotePatterns` as needed; add heavy libs to `optimizePackageImports`.

## .env.example

```
# Optional backend. Leave unset to run with bundled static data.
NEXT_PUBLIC_API_URL=
```

## pnpm-workspace.yaml (optional, for build allowlists)

```yaml
allowBuilds:
  sharp: false
```

## scripts/check-comments.mjs

See the original in the sunao repo; the allowlist is the point. Copy it verbatim and adjust
`ROOT` if source lives elsewhere. Allowlist entries:

- `SPDX-License-Identifier:`
- `(c)` / `License:`
- `eslint-disable` / `biome-ignore`
- `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`
- `TODO #123` / `FIXME #123` (must reference an issue number)
- `<reference ...` directives
- Public JSDoc (`/** ... */`)

## .gitignore additions

```
/node_modules
/.next/
/coverage
test-results/
playwright-report/
.env*
.vercel
*.tsbuildinfo
next-env.d.ts
artifacts/
.worktrees/
todo.md
```
