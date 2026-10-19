---
name: bitter-workflow
description: Enforces the 7 core development rules and architecture patterns for the bitter project (Twitter clone). Use whenever contributing, modifying code, authoring documentation, or adding features to bitter.
---

# Bitter Workflow & Architecture Guide

Inviolable engineering principles, patterns, and workflows for the `bitter` codebase.

## 1. Core Invariants

### 1.1 No Unit Tests
- Never write unit tests or mock suites (`*.test.*`, `*.spec.*`).
- Use end-to-end browser journeys via Playwright (`apps/web/e2e/`) or live operational smoke runs.

### 1.2 Minimal Essential Comments
- Eliminate tutorial, narrative, or code-rephrasing comments.
- Only mandatory top headers (e.g. Solidity SPDX/NatSpec or strict compiler directives) are permitted.

### 1.3 Check Latest Documentation
- Always consult current official documentation before integrating libraries or tools.
- Verify API changes, options, and deprecations rather than relying on stale habits.

### 1.4 ASD-STE100 English for Wikis
- Write all repository guides in `wiki/` using ASD-STE100 (Simplified Technical English):
  - Instructions: $\le 20$ words per sentence.
  - Descriptions: $\le 25$ words per sentence.
  - Paragraphs: $\le 6$ sentences.
  - Active voice, simple present/past tenses, unambiguous terms.

### 1.5 Good CSS Rules
- Before writing CSS, refer to [https://good-css.com/](https://good-css.com/) and follow it:
  - Logical properties only (`margin-block`, `padding-inline`, `inline-size`, `block-size`). No physical coordinates (`top`, `left`, `right`, `bottom`).
  - Colors defined in `oklch()` with `color-mix()` for tints and hover surfaces.
  - Fluid sizing with single `clamp()` tokens rather than breakpoint cascades.
  - Hover states wrapped in `@media (hover: hover) and (pointer: fine)`.
  - Motion transitions wrapped in `@media (prefers-reduced-motion: no-preference)`.
  - Style focus with `:focus-visible` outlines; never `outline: none`.
  - Overflow bounded with `overflow: clip`.

### 1.6 Frequent Structured Commits
- Commit after every small-to-medium change.
- Format every commit message:
  ```
  <type>(<scope>): <summary>

  ### What Changed
  - <detailed itemized changes>

  ### Why
  - <design rationale>

  ### Impact
  - Performance: <impact>
  - UI/UX: <impact>
  - Architecture: <impact>
  ```

### 1.7 Save Work as a Skill
- Update and record newly learned procedures, architectures, and domain patterns into `.agents/skills/` and `~/.agents/skills/`.

---

## 2. Monorepo Architecture & Seams

```
bitter/
├── apps/
│   └── web/                   # Next.js App Router (pages, actions, routing)
│       └── e2e/               # Playwright E2E browser suites
├── packages/
│   ├── types/                 # Shared DTOs, request models, event contracts
│   ├── db/                    # Drizzle ORM schemas, PGlite local database client, migrations
│   ├── api/                   # High-abstraction domain service layer (pure business logic)
│   ├── ui/                    # Twitter/X design system + shadcn components (good-css compliant)
│   └── config/                # Shared Biome configuration, TS presets
└── wiki/                      # ASD-STE100 technical documentation
```

### Module Boundaries
- UI and Web components **never** import database tables directly from `@bitter/db`.
- All data access passes through domain services in `@bitter/api` (`FeedService`, `PostService`, `InteractionService`, `UserService`).
- Database client uses `@electric-sql/pglite` locally (`data/pgdata`) with zero Docker dependency, allowing a one-line client swap to Neon in production without touching schemas or queries.

---

## 3. UI & State Patterns

- **Theme**: Twitter "Lights Out" dark mode (`oklch(0% 0 0)` black canvas, `oklch(14% 0 0)` card surfaces).
- **Feed**: TanStack Query `useInfiniteQuery` reading cursor-paginated endpoints.
- **Interactions**: Optimistic mutations on likes and reposts with instant counter updates and rollback on error.
- **Composer**: 280-character maximum tracked by an accessible SVG circular progress ring.
- **Guest Access**: All feed, profile, and post thread views remain readable to unauthenticated visitors without forced redirects.
