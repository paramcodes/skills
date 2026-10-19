# Testing templates

## vitest.config.ts

```ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**", "**/.worktrees/**"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
```

Swap `happy-dom` for `jsdom` if the app depends on jsdom-only APIs (rare). happy-dom is faster.

## src/test/setup.ts

```ts
import "@testing-library/jest-dom/vitest";
```

## playwright.config.ts

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: true },
});
```

## Seed E2E specs

- `e2e/smoke.spec.ts` — home renders, no console errors.
- `e2e/reduced-motion.spec.ts` — under `prefers-reduced-motion: reduce`, transitions are scoped to
  color/opacity only.
- `e2e/persistence.spec.ts` — act, reload, assert: likes, playlist edits, created playlists
  survive a hard reload (localStorage, no backend).
- `e2e/full-journey.spec.ts` — whole surface end to end: idle player, search, like + undo,
  playlist persistence, mobile shell, and a navigation/interaction perf budget with long-task
  recording.
- `e2e/queue-toggle.spec.ts` style specs for any collapsible panel (assert `inert` + opacity
  contract).

## Verification skill skeleton

Create `.opencode/skills/verify-<app>/SKILL.md` plus `features/*.md` recipes. Each feature file
describes how to drive that feature with Playwright and what to assert. Refresh recipes when
behavior changes. This is the agent's "how to prove it works" map — the difference between a
project agents can verify and one they can only guess about.

Minimal SKILL.md frontmatter:

```markdown
---
name: verify-<app>
description: Verify the <app> app by launching it locally, driving the UI with Playwright, and capturing evidence. Use when asked to verify, smoke-test, or prove a feature works.
---
```

Body: list features and point to `features/*.md`.

## Unit test guidance

- Test behavior, not implementation: call the code the way users do, assert observable results
  against literal expected values.
- Colocate tests next to source (`foo.test.ts` beside `foo.ts`) or in `__tests__`.
- Use MSW for network mocking in component tests; avoid real network in unit tests.
- Prefer `@testing-library/user-event` over `fireEvent`.
- A test that still passes when every imported function returns `undefined` is not a test —
  rewrite or delete it.
