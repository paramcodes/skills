---
name: productionize
description: >-
  Take a tutorial-quality web app to production quality: tooling, tests, design
  system, performance ledger, accessibility, SEO, persistence, docs. Use for
  "productionize this", "level up this project", "make this production-ready",
  "harden this project", "what's missing from a production app", "upgrade from
  tutorial quality", or auditing a project's engineering baseline.
---

# Productionize

Audits and upgrades a web app from "it runs on my machine" to a shippable product. Based on
the engineering baseline that made `sunao` (Next.js 16 + Tailwind v4 + shadcn) read like a
product instead of a demo: strict tooling, real tests, a design system with motion rules,
a performance ledger, an accessibility pass, a discoverability surface, a persistence seam,
and a docs wiki.

## When to apply

- The project builds and runs but has no CI, no tests, no lint gate, or no pre-commit hook.
- The UI works but has no tokens, no motion rules, no reduced-motion support, no empty/loading states.
- State is scattered (in-memory Sets, module-level arrays, ad-hoc localStorage).
- There is no performance measurement, no SEO surface, no docs wiki.
- The user asks to "level up", "harden", "productionize", or audit baseline quality.

## Scope and non-goals

- Target: web apps (Next.js / Vite+React / similar). Adapt paths for other stacks; keep the
  principles. Do not force Next.js-specific files onto a Vite app.
- This skill does not rewrite features. It adds the engineering scaffolding and the polish
  layer around existing features. Feature work stays separate.
- Skip a phase if the project already has it and it is healthy. Re-running a healthy phase
  wastes time and risks churn. Verify presence first (see Phase 0).

## Operating rules

- **Measure before changing.** Capture a baseline (build, lint, tests, Lighthouse) in Phase 0
  so every later phase has a number to beat or hold.
- **One phase per commit/PR.** Each phase must leave the app buildable and tests green.
- **Verification gate per phase**: `typecheck` (or equivalent) · `lint` · `test` · `build` ·
  the phase's own smoke check on the live surface. A phase is not done until the live surface
  is proven, not just the unit tests.
- **Do not delete user work.** If a file already exists and differs, read it, diff, and ask
  before overwriting. Prefer editing over replacing.
- **Idempotent.** Re-running a phase should be a no-op when already satisfied.

## Phase 0 — Inventory and baseline

Goal: know what exists and capture numbers.

1. Detect stack: read `package.json`, lockfile, framework config, `tsconfig`, styling setup.
2. List existing quality gates: lint, format, typecheck, test, e2e, CI, hooks, comment policy.
3. Run whatever gates exist; record pass/fail and timings.
4. If a production build is possible, run it and note bundle size / warnings.
5. If Lighthouse is available, run mobile perf on `/`, `/search` (or main routes); record
   score, LCP, CLS, TBT. Otherwise note "no baseline" and plan to add it later.
6. Write a short `docs/baseline.md` (or append to `PERF.md`) with the snapshot. This is the
   "before" picture every later phase is measured against.

Exit: a written baseline exists; you know which phases are already satisfied.

## Phase 1 — Tooling baseline

Goal: one fast linter/formatter, strict types, pre-commit hook, CI, env example.

- Package manager: prefer `pnpm` (strict `node_modules`, fast, disk-efficient). If the project
  uses npm/yarn and is small, do not force a migration; note it as optional.
- TypeScript: enable `strict: true` in `tsconfig.json`. Add path alias `@/* -> ./src/*`.
- Lint/format: prefer **Biome** (one tool, fast). Config at `biome.json`. Enable VCS integration
  (`useIgnoreFile: true`), Tailwind CSS directives in the CSS parser, and sensible overrides
  (e.g. allow `dangerouslySetInnerHTML` only where JSON-LD is rendered). See
  `references/tooling-templates.md`.
- Pre-commit: **Husky + lint-staged**. `.husky/pre-commit` runs `npx lint-staged`. lint-staged
  runs Biome `--write` on staged `*.{ts,tsx,js,mjs,json,css}`.
- Comment policy: add `scripts/check-comments.mjs` (allowlist: SPDX, biome-ignore, @ts-expect-error,
  TODO/FIXME with issue numbers, JSDoc). Add `pnpm check:comments` script. Rationale: comments
  rot in agentic workflows; code should be self-documenting. See the script template.
- CI: `.github/workflows/ci.yml` running on push/PR to main: checkout, pnpm setup, node setup
  with pnpm cache, `pnpm install --frozen-lockfile`, then `typecheck`, `lint`, `check:comments`,
  `test`, `build`.
- Env: `.env.example` with every `NEXT_PUBLIC_*` / public var documented as optional/required.
- Scripts in `package.json`: `dev`, `build`, `start`, `lint`, `lint:fix`, `format`, `typecheck`,
  `test`, `test:watch`, `test:e2e`, `check:comments`, `prepare` (husky).
- `.gitignore`: node_modules, .next, coverage, test-results, playwright-report, .env*, .worktrees,
  *.tsbuildinfo, next-env.d.ts, artifacts.

Verification: `pnpm install --frozen-lockfile` succeeds; `pnpm typecheck && pnpm lint &&
pnpm check:comments && pnpm build` all pass on a clean tree.

## Phase 2 — Testing harness

Goal: unit/component tests + E2E + a verification skill that drives the app.

- Unit/component: **Vitest + React Testing Library**. `vitest.config.ts` with `happy-dom`
  (faster than jsdom for most cases), `globals: true`, setup file registering
  `@testing-library/jest-dom`, alias `@ -> ./src`, excluding `e2e/`, `node_modules/`, `.next/`,
  `.worktrees/`. See `references/testing-templates.md`.
- Setup file `src/test/setup.ts`: import `@testing-library/jest-dom/vitest`.
- E2E: **Playwright**. `playwright.config.ts` with `testDir: "./e2e"`, `baseURL` on :3000,
  `webServer` starting `pnpm dev` with `reuseExistingServer: true`.
- Seed specs: `smoke.spec.ts` (home renders), `reduced-motion.spec.ts` (transitions scoped to
  color/opacity under `prefers-reduced-motion`), `persistence.spec.ts` (act, reload, assert for
  state that should survive), `full-journey.spec.ts` (whole surface + a perf budget with long-task
  recording). Add more as features land.
- Verification skill: create `.opencode/skills/verify-<app>/SKILL.md` plus `features/*.md` recipes
  for driving each feature with Playwright. This is the agent's "how to prove it works" map.
  Refresh recipes when behavior changes.
- TS types: add `vitest/globals` and `@testing-library/jest-dom` to `tsconfig` `types`.

Verification: `pnpm test` green; `pnpm test:e2e` green on smoke; verification skill loads.

## Phase 3 — Design system and motion

Goal: tokens, motion rules, accessibility baseline, mobile basics.

- Tokens in `globals.css` as CSS variables: brand accent + dark variant, surfaces (bg, bg-elev,
  bg-card), text (fg, fg-muted), border. Map shadcn variables (`--background`, `--card`,
  `--primary`) onto the tokens so `bg-primary` resolves to the accent.
- Motion tokens: `--ease-out` (enters/exits/press), `--ease-in-out` (on-screen movement),
  `--ease-drawer`; named-property transitions only, 100-150ms; never `transition: all`.
- Press feedback: `scale(0.96)` on active, never below 0.95.
- Hover: only inside `@media (hover: hover) and (pointer: fine)` (fixes sticky hover on touch).
- Reduced motion: keep opacity/color feedback, drop movement; animations removed outright
  (`animation: none`), transitions scoped to named properties at 100ms.
- Typography: one font via `next/font` (or equivalent), `--font-sans` wired, antialiased root,
  `text-wrap: balance` on headings, `text-wrap: pretty` on body, `tabular-nums` on all time/number
  displays.
- Scrollbars: a `.scroll-pane` utility (thin, transparent track, translucent thumb brightening
  on hover) applied to every scrollable region.
- Long lists: `.song-row` style with `contain: layout style` + `content-visibility: auto` and a
  known intrinsic height — cheap always-on virtualization before reaching for TanStack Virtual.
- Cursors: `button { cursor: pointer }` once in globals (primitives often reset it).
- Components: shadcn on a primitive library (Base UI / Radix). Copy-paste components we own.
- Empty states take an optional `action` slot. Loading states render skeletons matching the real
  layout (prevents CLS). Toasts (sonner) themed to surface and offset above fixed bars.
- Touch targets ≥ 44px on mobile (`min-h-11`), bottom nav below `lg`, bottom sheet for
  secondary panels.
- Collapsible panels narrow to a rail instead of unmounting; controlled region goes `inert`.

See `references/design-tokens.md` for the CSS skeleton.

## Phase 4 — Performance ledger

Goal: measure, don't guess; keep a written record of wins and reverts.

- Create `PERF.md` with a baseline table (route, score, LCP, CLS, TBT) measured by Lighthouse
  mobile (`--only-categories=performance`) against a production build, simulated slow 4G, 4x CPU.
  Machine noise is ±0.2s LCP / ±300ms TBT; a delta smaller than that is not a win.
- Sections: **Baseline**, **Kept** (change, before→after, why), **Reverted** (idea, result, why),
  **After this pass**, **Open, not yet attempted**.
- Apply low-risk wins: `h-full` on panels that resize after data resolves (CLS), reserve height
  for loading states, group/join in O(n) instead of O(n²), cap unbounded `select("*")` with a
  default limit + ordering, `optimizePackageImports` for heavy icon/component libs, lazy-load
  heavy panels.
- Do not apply `priority` to images unless the LCP element is actually an image — measure first
  (the LCP is often the `<h1>`).
- Virtualize genuinely long lists with TanStack Virtual; use `content-visibility` for the rest.
- Cache external fetches (iTunes/CDN) with a TTL and an LRU bound, not an unbounded `Map`.
- Re-measure after each change; record the delta. Revert if no measurable win.

See `references/perf-ledger.md` for the template.

## Phase 5 — State and persistence

Goal: clear ownership, a repository seam, validated boundaries.

- Three owners, no overlaps: **store** (playback/UI ephemera), **query** (server state + library),
  **component** (local UI state). Document which is which in `docs/architecture.md`.
- Repository seam: define a `Repo` port (interface) for any persisted domain (playlists, likes,
  settings). Provide two adapters: `localStorage` (default, no backend) and the real backend
  (Supabase/etc.), selected by a `hasBackend()` flag. Delete the legacy ad-hoc storage code in
  the same pass (migrate callers, then delete — do not keep a compatibility layer).
- localStorage adapter: one versioned document (`app.library.v1`), Zod-validated on read, corrupt/
  absent values fall back to seed. Cache by raw string, invalidate on `storage` event and tab
  focus so two tabs stay consistent.
- Optimistic updates via the query library: paint on `onMutate`, roll back on `onError`, invalidate
  on `onSettled`.
- Zod at every boundary: external API rows, static dataset, localStorage documents. Parse, don't
  assert.
- Persist user preferences (volume, mute, shuffle, repeat) in a versioned localStorage key.

## Phase 6 — Accessibility pass

Goal: keyboard, focus, ARIA, reduced motion, touch.

- ARIA labels on every interactive control; tooltips showing action + shortcut (`<Kbd>`).
- Keyboard shortcuts guarded against inputs (no firing while typing); Space/Enter handling.
- Skip-to-content link as the first focusable element.
- Focus returns to the trigger when a dialog/sheet/panel closes.
- Collapsed panels: content goes `inert` (drops from tab order + a11y tree) but stays in DOM.
- Reduced-motion verified on the live surface (Playwright with `prefers-reduced-motion: reduce`).
- Touch targets ≥ 44px; mobile nav items `min-h-11`.
- `button { cursor: pointer }` restored (primitives reset it).

## Phase 7 — SEO and discoverability

Goal: crawlable without JS, AI-search friendly, no training scraping.

- Metadata API: root metadata + per-route metadata. One `SITE_URL` constant (`lib/site.ts`) so
  canonical URLs and the sitemap never drift.
- Route files: `robots.ts` (search crawlers allowed, AI-search crawlers explicitly allowed,
  model-training crawlers denied), `sitemap.ts`.
- JSON-LD on key pages (WebApplication, FAQ, BreadcrumbList) via
  `dangerouslySetInnerHTML` in a server component, with a biome override for that file.
- `public/llms.txt` and `public/llms-full.txt` for answer engines.
- DNS preconnect/prefetch hints for API hosts in the root layout.
- Measure for real (not Lighthouse alone): see `docs/concepts/seo-and-ai-discovery.md` pattern.

See `references/seo-checklist.md`.

## Phase 8 — Docs and README media

Goal: a wiki that teaches the patterns shipped, plus media that proves the UI.

- `docs/` wiki: `README.md` (index), `stack.md` (what/why/why-not), `architecture.md`,
  `design-system.md`, `workflows.md`, `roadmap.md`, `PERF.md`, `concepts/*.md` (state ownership,
  persistence, server/client, audio engine, seo). Keep each short and decision-focused.
- `README.md` at repo root: features, screenshots, demo GIF/video, quick start, contributor
  guide, deploy.
- Media capture: `scripts/capture-readme.mjs` driving a running server with Playwright, writing
  screenshots + `demo.webm`, then `ffmpeg` for `demo.mp4`/`demo.gif`. Document `CAPTURE_BASE`,
  `CAPTURE_OUT`, `CAPTURE_SHOTS`.
- Store artifacts under `artifacts/<name>/` and gitignore them.

## Phase 9 — Git and PR flow

Goal: cheap reverts, reviewable history, gated merges.

- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`.
- One focused change per commit; each commit ends in a verified state.
- Branch → PR → CI green → squash-merge → delete branch.
- For UI changes, attach a screenshot/GIF/video to the PR.
- Verification skill + feature map updated after each phase.
- Worktrees ignored in vitest and linting (`.worktrees/`) so a nested checkout doesn't double
  the test/lint surface.

## Phase 10 — Verification gate (run after every phase)

```
pnpm typecheck
pnpm lint
pnpm check:comments
pnpm test
pnpm build
pnpm test:e2e          # at least smoke + the phase's spec
# plus: drive the changed feature on the live surface (verification skill recipe)
```

A phase is not done until all pass and the live surface is proven.

## Done means

- Phase 0 baseline written.
- Phases 1-9 applied (or explicitly skipped with reason in the baseline doc).
- Phase 10 gate green.
- `docs/` wiki exists and is accurate.
- `PERF.md` has a baseline and at least one measured result or an explicit "not yet measured".
- A verification skill exists and its recipes run.

## Anti-patterns to refuse

- Adding ESLint + Prettier when Biome already covers it (config sprawl).
- Keeping a compatibility layer after migrating callers (delete in the same pass).
- `transition: all` or unbounded `Map` caches.
- Comments that narrate what the code does (let code be self-documenting; allowlist only).
- `priority` on images without measuring LCP.
- Declaring done from "it compiles" — prove on the live surface.

## References

- `references/tooling-templates.md` — biome.json, CI, tsconfig, next.config, scripts, .gitignore.
- `references/testing-templates.md` — vitest, playwright, setup, verification skill skeleton.
- `references/design-tokens.md` — globals.css token skeleton.
- `references/perf-ledger.md` — PERF.md template.
- `references/seo-checklist.md` — robots/sitemap/metadata/JSON-LD/llms.txt checklist.
- `references/docs-templates.md` — docs wiki skeleton and capture script notes.
