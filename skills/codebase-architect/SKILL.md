---
name: codebase-architect
description: Design, scaffold, refactor, or audit a codebase so that agents and humans can find files in one hop, change them safely, and get fast, actionable feedback. Use for new project structure, folder reorganization, AGENTS.md or CLAUDE.md setup, architectural boundary rules, and renames or migrations that touch many files. Covers single-app and monorepo layouts, types-first safe defaults, deep module design, native boundary enforcement (2026 tooling), generated contracts, a verification ladder with boot checks, risk-tiered autonomy, and runtime-surface verification. Scale the structure to the project; small tasks need only §2, §12, and §16.
---

# Codebase Architect

> **Revision 3 (2026-10-24).** Now the single skill of its kind: absorbs the unique doctrine of `agent-ready-project` (types-first defaults §4, deep modules §3, risk tiers §1, measurement §7, anti-patterns, hardening pass §14) and retires that skill. Earlier revisions had removed the bundled custom checker in favor of native tooling and added generated contracts, the verification ladder + boot check, runtime-surface tooling, the drive-the-app artifact, plan-through-code, and the gardening loop. **Revision 3.1 (same day):** §10 gained a task-breakdown subsection (vertical slicing, sizing heuristics, task shape, risk-first checkpoints, plan home) plus parallelization rules, and §15 gained the right-thing/thing-right framing — adopted from Addy Osmani's `planning-and-task-breakdown`. Sources at the end.

## Mission

Produce a repository that is understandable, navigable, and safe to change, with structure proportional to the project's size, risk, and team. Principles are universal. Layout, tooling, and enforcement are chosen per project.

Two failure modes to prevent:

- **Wrong place, wrong layer.** Files land in the wrong folder, imports cross layers, and generic dumping grounds grow.
- **Unverified change.** A rename or edit misses a site, a migration breaks stored data, or a passing check did not actually run.

## 1. Scale the process to the work

Classify the request first. The highest signal that applies sets the tier.

- **Foundational:** a new project layout, a folder reorganization, a rename or contract change across modules, a persisted-data format change, auth or sensitive data, or a decision that is hard to reverse. Write a plan (§10) and enforce boundaries mechanically (§6).
- **Feature-sized:** new user-visible behavior spanning more than one module. Clarify acceptance criteria, check affected boundaries, implement in increments, and verify the workflow.
- **Small or localized:** one bounded change inside one module, with no contract change. Inspect context, change it, run the narrowest check, and summarize in one to two sentences. Do not create a plan or new guardrails.

If the work grows, reclassify and say so. A small diff does not excuse skipping a check on data integrity or security that the change touches.

**Delegation size scales with verifiability.** A change class is safe to hand to an agent unattended when a tier check plus runtime observation can fail it; verification depth scales with blast radius, not diff size. Where mistakes are irreversible or the outcome is hard to verify, keep the human in the loop — no finite set of checks covers every consequence.

**Risk tiers decide permission; verifiability decides size.**

- **Low (proceed):** read the repo, search, run unit tests, scoped code changes.
- **Medium (proceed, record):** dependency updates, migrations, network access, generated code, CI config.
- **High (stop and ask):** production systems, secrets/credentials, destructive operations.

A perfectly valid agent output for a high-tier request is a plan plus a request for confirmation, not a finished change.

## 2. Discover before deciding

### Existing repository

1. Read existing instructions (`AGENTS.md`, `CLAUDE.md`, README, `docs/`).
2. Check `git status` and the current diff. Preserve unrelated and uncommitted work.
3. Read manifests, entry points, configuration, and tests. Identify the commands the project already uses.
4. Trace the real workflow the change affects: follow imports, configuration strings, routes, and registries. Do not stop at the nearest file with a matching name. Same-named files are common, and some are deprecated decoys.
5. Keep existing conventions unless they are harmful to the outcome. Replace tools only with a demonstrated benefit.

Do not assume conventional folders, commands, or test runners exist. Exclude generated output, caches, dependencies, and vendored code from searches unless the task is about them.

### New repository

Establish the product's purpose, critical workflows, target platforms, deployment environment, external interfaces, data sensitivity, and any user-selected technologies before choosing a layout. Choose the stack from those answers.

### Questions and assumptions

Ask only questions whose answers would change behavior, architecture, cost, safety, or scope, and never ask what the repository already answers. For a real blocker, ask one concise question with a recommended default. Otherwise make a conservative, reversible assumption, state it in the final response, and continue.

## 3. Structure the repository

### Principles

- **Find any relevant file in one hop.** Colocate code that changes together. Prefer grouping by domain feature when the project has several distinct domains. A small project can stay flat.
- **Explicit names.** Name files by domain and role, for example `billing.service.ts`, `billing.repo.ts`, `reorder.calc.ts`. Avoid `utils`, `helpers`, `common`, and `misc`; they become dumping grounds.
- **Public surfaces, not barrels.** A catch-all `index.ts` re-export blob hides true import paths and defeats dead-code analysis — forbid it. A curated per-feature public-surface file (`boards.api.ts` or `boards.schema.ts` — the one file other features may import) is not a barrel; it is a contract. Forbid the blob, bless the surface.
- **One-way dependencies.** Transport (routes, API handlers, components) calls services. Services call repositories and pure calculation modules. Repositories call the database client. Lower layers never import upward.
- **Contract-only cross-feature imports.** A feature may import another feature's public surface or schema, never its services, repositories, or internal components. If two features need the same behavior, move it into a service that orchestrates both, or into `shared/`.
- **Split `shared/` by capability** in a single app, such as `shared/kernel` (universal types), `shared/calc` (pure logic, no I/O), `shared/telemetry`, `shared/ui` (frontend only). Never mix backend logic and UI helpers in one folder.
- **File size as a review trigger, never a guard.** Use ~400 lines as the default threshold for a second look, and split when splitting makes the file easier to read. Never convert this into a lint or CI threshold — it is a proxy metric, and enforcing proxies manufactures false positives.

### Deep modules at clean seams

Design each module for locality (change one area) and blast radius (small edits, small regressions):

- A module is an interface plus implementation. Aim **deep**: small interface, lots of behavior behind it.
- Accept dependencies, don't create them (`processOrder(order, gateway)` not `new StripeGateway()`); return results, don't mutate inputs.
- A seam is where behavior can change without editing there. One adapter is a hypothetical seam, two adapters is a real one — never introduce the second speculatively.
- Deletion test: if deleting the module makes its complexity reappear across N callers, it earned its place.
- Prefer a direct one-way dependency through a public contract over a new event bus — events add delivery, ordering, idempotency, and observability obligations.
- Shared code must be genuinely shared, not a dumping ground for disputed types.

### Monorepos and workspaces

The same one-way rules apply at package level: `apps/web → ui, api(client types)` · `api → domain, db` · `db → domain` · `domain → ∅` (pick the equivalents for your domain). Expose each package through subpath exports that point at feature surface files (`@acme/domain/issues`), so package boundaries stay explicit, deep imports across packages can be forbidden by tooling, and each package keeps a deliberately small public surface. Tests colocate with the code they test; name the tiers (`*.test.ts` unit, `*.integration.test.ts` integration, `*.e2e.test.ts` browser) rather than building parallel test trees.

### Example layout (TypeScript web app, illustrative)

```
src/
  features/
    boards/
      boards.api.ts          # public surface — the only file other features import
      boards.schema.ts       # zod contract at the boundary
      boards.service.ts
      boards.repo.ts
      boards.api.test.ts
      AGENTS.md              # optional, under 30 lines, only for real domain invariants
    cards/  …
  shared/
    kernel/  calc/  telemetry/  ui/
  server/
    db/                      # the only place the database client is created
docs/
  ARCHITECTURE.md  DB_SCHEMA.md  adr/
AGENTS.md
CLAUDE.md -> AGENTS.md
```

A monorepo lifts these folders into packages; a Python or Rust project keeps the principles with its own conventions. Derive the layout from the project; do not copy this one.

### Vocabulary

Use consistent domain terms in names and tests; a glossary only when naming confusion causes real coordination problems. Decision recording lives in §10 (decision log → ADR promotion).

## 4. Safe defaults by construction (types)

The compiler is the highest signal-per-second guard. Make illegal states unrepresentable, in the project's language:

- **Strictness first:** TS `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`; Python `mypy --strict`/pyright; Rust defaults (no `unsafe` without justification); Go `errcheck`/`vet`.
- **Branded semantic primitives:** `type UserId = string & { readonly __brand: "UserId" }` — a wrong-id comparison does not compile.
- **Typed errors:** domain error classes (`NotFoundError`, `TransitionNotAllowedError`), never bare `Error` or strings; map them to transport codes in exactly one place.
- **Parse at boundaries, trust inside:** validate untrusted input once, at HTTP/DB/env edges (zod/pydantic/valibot); internal code trusts the types — no defensive re-validation.
- **Exhaust variants:** exhaustive switch/match with compile-time exhaustiveness, so adding a variant fails every stale switch.
- **Default-safe posture:** parameters local, immutable, non-null by default; every cost (mutability, sharing, async, nullability) is an explicit opt-in.
- **No `any`, no broad suppressions** added to satisfy a check — fix the code or the check.

## 5. Generated contracts (no drift)

Anything derivable from a schema is generated, never hand-written:

- The schema is the single source of truth (OpenAPI/GraphQL/protobuf/DB schema).
- Commit generated output so agents read real types on any checkout.
- Banner every generated file with a greppable marker: `// GENERATED FILE — DO NOT EDIT. Run <cmd> to regenerate.`
- Gate in CI with a regen-diff: regenerate and fail if the committed output differs.
- State in `AGENTS.md`: import generated types; never hand-write a shape codegen owns.
- **Inferred contracts need no machinery.** In a monorepo with end-to-end inferred types (tRPC, Drizzle), the contract is the type graph — a breaking change fails `tsc` across packages. Do not add snapshot or hash machinery on top of what the compiler already proves; revisit only when an external API makes the contract invisible to the compiler.

## 6. Make boundaries mechanical (lean, native, proven)

Prose rules drift under context pressure. For each boundary the project actually depends on, wire a check that runs in one command — using the ecosystem's native tool, not a hand-rolled linter:

| Stack | Native enforcement |
| --- | --- |
| TypeScript / JavaScript | Biome: nested per-package configs, `noRestrictedImports` with why+fix messages for layer rules, multi-file `noImportCycles` |
| JVM | ArchUnit rules with `because` + suggestion fields |
| Go | golangci-lint (depguard) |
| Python | import-linter |
| Rust | crate/workspace boundaries, feature flags |

Principles that survive any tool:

- **Self-healing messages.** Each violation states the rule broken, the location, and a `Remediation:` line saying how to fix it without guessing. An agent that can self-correct on the spot doesn't need a human.
- **Parser over regex.** Use a tool that parses the whole file, so multi-line, dynamic, and re-export imports are seen.
- **Prove every guard once, at introduction,** with two fixtures: one that violates (the check must fail, with the remediation message) and one legitimate pattern it must NOT flag. No permanent proof harness — the demonstration lives in the introducing PR.
- **Keep a rejected list with revisit conditions** (the gardening loop in §13 feeds it). Re-adding a rejected guard requires new evidence of the failure it catches.
- **Custom checkers are a last resort,** written only when a native tool genuinely cannot express the boundary, the failure mode has actually been observed, and a test proves the checker fires.

## 7. Verification ladder + boot check

Name the tiers and publish the routing so agents run the cheapest relevant one:

| Tier | Runs | When |
| --- | --- | --- |
| `check` | lint + format check + typecheck | every edit |
| `verify` | check + unit tests | before every commit |
| `verify:full` | verify + integration + boot check + browser tests | PR / phase end |
| `test:file <path>` | one test file | tightest loop |

- **Boot check:** construct the app's wiring (DI container, module graph, route/registry registration) without serving traffic. Catches wiring errors that typecheck and unit tests miss — exactly what agents introduce when adding a dependency.
- `.env.example` is the canonical env contract; the boot check loads it; a new variable lands there or CI fails.
- Give tiers latency budgets (unit <3s, integration <10s) and keep `verify:full` wall-clock a tracked number — verification speed is the rate limiter once agents parallelize.
- Track three numbers per run: success rate, wall clock, expense. `verify:full` wall-clock is one of them — the measurements decide which tier agents may run unattended.

## 8. Context routing for agents

Keep the root instruction file short, so every session starts with useful context and not noise. Research (2026): context-file bloat measurably hurts — auto-generated instruction files reduce agent task success; the value is accurate commands plus domain knowledge the model can't infer from the repo.

- **Root `AGENTS.md`, under 80 lines.** Purpose, the tier commands, placement rules that are NOT machine-enforced, and a routing table to `docs/` and feature folders.
- **`CLAUDE.md` is a symlink to `AGENTS.md`** so every harness shares one source. Where symlinks are unavailable (Windows without `core.symlinks`), a `CLAUDE.md` containing only `@AGENTS.md` is the fallback.
- **Scoped `AGENTS.md` files** inside a feature or shared folder, under 30 lines, only for invariants that apply there (integer-cent currency, token-hashing, purity rules). Never create empty stubs.
- **On-demand `docs/`** for architecture, schema, and ADRs; agents load these when the routing table points to them.
- **The repo owns a drive-the-app artifact:** a script or skill that launches the application, operates it as a user would, and asserts the outcome, plus a feature map of what can be driven. Maintained like code — when the app changes, the feature map is reconciled in the same PR, because verification instructions go stale as fast as any other doc.
- **Instruction files shrink over time.** Prose keeps judgment; exact invocations live in package scripts or CLIs. As models and tooling improve, move commands out and let the file get smaller — that trend is health, not neglect.
- Do not duplicate in prose what a check enforces (lint leakage), and do not keep several instruction files that can drift apart. Check after installing agent plugins or skills that nothing has been cloned into the repository root.

### Root `AGENTS.md` template

```markdown
# AGENTS.md

## Purpose
<one paragraph>

## Commands (scoped first)
- Single test: `<exact command for one test file>`
- Typecheck + lint: `<command>`           # tier: check
- Full gate before PR: `<command>`        # tier: verify:full

## Placement rules (the checks do not enforce these)
1. Features live in `src/features/<domain>/`; each owns one public surface file.
2. Pure logic goes to `src/shared/calc/`; the db client exists only in `src/server/db/` and repo files.
<boundary and import rules live in the boundary check's config, not here — link to it>

## Routing (read on demand)
- Architecture and layers: `docs/ARCHITECTURE.md`
- Database tables and invariants: `docs/DB_SCHEMA.md`
- Decisions and rejected options: `docs/adr/`
- Domain invariants: `src/features/<domain>/AGENTS.md`
- Boundary rules and how to satisfy them: `<path to the boundary-check config>`
- Launching and driving the app: `<path to the drive-the-app script/skill and its feature map>`
```

## 9. Establish a baseline that stays reproducible

Canonical commands for formatting, linting, type checking, the ladder tiers, build, run, and dependency installation with a lockfile. No duplicate or conflicting commands, no placeholder commands presented as real. A clean checkout reproduces the setup.

Validate required configuration at startup so failures are clear. Validate untrusted input at runtime boundaries even when static types exist. Keep secrets out of source control and grant CI jobs least privilege.

### Dependencies

Add a dependency only with a clear benefit that would be costly to implement. Check maintenance activity, known vulnerabilities, license compatibility, whether an equivalent is already in the tree, and whether the lockfile pins it.

### Ignore rules and staging

`.gitignore` covers caches, build output, local databases, and agent tool directories. Stage explicit paths (`git add <file>`), review `git diff --cached --name-only`, and avoid `git add -A` unless `git status` has been reviewed.

### Hooks and CI

Pre-commit runs lint/format on staged files only — nothing else survives there; slow hooks teach bypassing. Every real gate (typecheck, tests, boundary checks, boot check) runs in CI, using the same canonical commands. A written rule is not enforcement.

## 10. Plan foundational work and protect existing work

For foundational work, write the plan before coding:

```
Goal: <one sentence>
Acceptance criteria:
  - <observable, testable condition>
Affected areas: <modules, contracts, data files, configuration>
Steps (dependency order):
  1. <step> -> verify: <check>
Risks and rollback: <risk -> mitigation; how to revert>
Assumptions and open questions: <list>
```

Plans are contracts, not exploration. The template records what must hold and how each step verifies; it does not explore how a design might work. Resolve open design questions through code — a spike, or a switchable prototype with variants side by side; parallel sketches reviewed by a different model or a fresh reader beat one long deliberation. Long abstract plans give the illusion of progress.

Intent is a snapshot that goes stale. At each milestone, reconcile the plan and ADRs against what was actually built — a few minutes that keeps the docs trustworthy.

**Decision log.** During foundational work, record every non-obvious choice in a committable log — one row per decision: what, why, alternatives rejected. Promote the hard-to-reverse rows to ADRs; the log is the raw material ADRs are distilled from, written while the reasons are still fresh.

### Task breakdown

- **Slice vertically.** Each task ends at a working, observable state through the whole stack (schema → API → UI for one behavior), not a horizontal layer completed everywhere at once — horizontal slices maximize the time nothing works.
- **Size for the performer.** Agents perform best on tasks scoped to an hour or two inside one or two modules. Split any task with "and" in its title, one spanning two or more subsystems, or one with no single verifiable end state.
- **Shape each task:** one sentence of intent, acceptance criteria, its verification command, its dependencies — and likely files for the larger ones.
- **Order risk-first with checkpoints.** Schedule the high-risk, uncertain tasks early; order the rest by dependency. Every two or three tasks the repository must sit in a working state you could ship from.
- **Plans and task lists need a designated home** — wherever the repo's convention says (a docs folder or the team tracker); if none exists, `tasks/plan.md` and `tasks/todo.md` are fine defaults.

### Renames, contract changes, and migrations

1. **Enumerate every reference across the whole repository** — tests, fixtures, persisted data, configuration, string keys, log and format strings, documentation — not just one folder. Save the list as a checklist with one line per site.
2. **Edit each site explicitly** or with a language-aware rename tool. Never a global text replacement: it silently changes unrelated occurrences and intentional fallbacks.
3. **Dual-read before switching writers.** Readers accept old and new formats first; then writers switch; then stored data migrates. Keep the fallback until no old data remains, and say when it can be removed.
4. **Re-run the whole-repository search.** Every remaining hit must be on the checklist as intentionally kept.

### Splitting work

Split a task when its acceptance criteria are unclear, it crosses independent concerns, its verification loop is too broad, or parallel work would conflict. Never overwrite an unrelated incomplete plan or delete uncommitted work.

Parallelize independent vertical slices and documentation; keep migrations and shared-state changes sequential. When parallel slices share a contract, land and agree the contract first, then fan out.

## 11. Implement in small, reviewable steps

- Keep changes bounded. No unrelated refactors bundled in.
- Handle relevant failure paths, not only the happy path.
- Preserve public behavior unless a breaking change is intended and documented.
- Add a regression test for each confirmed bug; prefer tests that fail before the fix. A test whose expected value merely restates the implementation detects nothing — completion needs an observable result.
- Tests must not write to real data, shared directories, or the user's home. Use temporary paths.
- **Determinism:** unique IDs per test (never shared fixtures), seeded randomness, a frozen-clock helper. Flaky tests poison agent loops.

## 12. Verify real behavior

Start with the narrowest meaningful check and widen by risk: targeted test → unit/integration + `check` → build → runtime smoke → regression scope → full-diff review with actual command output.

Adapt to the system. Web: drive the real flow. API: representative requests incl. auth and failure paths. CLI: real commands with valid and invalid input, checking exit codes. Mobile: simulator or device. Library: consumer-facing imports and types.

**Runtime-surface tooling (2026, lean):**

- One test runner over CDP for the whole pyramid (e.g., Vitest browser mode) instead of a separate e2e framework.
- Lightpanda as a lightweight CI engine where it works, with per-suite fallback to headless Chromium where its engine falls short (SSE/WebSocket support still maturing) — a config change, never a rewrite.
- agent-browser (Vercel; Rust CLI over raw CDP) for agent-side self-verification during development: accessibility snapshots and annotated screenshots against the dev server. It is not a test framework.
- Prefer the repo-owned drive-the-app artifact (§8) over ad-hoc verification: every agent proves changes the same way, and the instructions cannot rot silently.
- Lighthouse-class audits need real Chromium regardless of the browser-test engine.
- A DOM assertion on a page a human cannot read proves little; a screenshot or bounding box shows.

### Recording results honestly

Record the real exit code of each check. `cmd | tail` reports the last command's status and can hide a failure — run checks alone or use `set -o pipefail`. A run that collects zero tests is a failure of the check, not a pass. Report each check as **passed**, **failed**, **not run**, or **blocked**, and never claim a pass without inspecting the result.

### When the environment cannot run the system

Run every supported check; report the rest as **blocked**, name the missing resource, and give the exact command the user should run. Do not describe the change as verified end to end.

## 13. Turn repeated mistakes into guardrails

When a mistake repeats, choose the least costly reliable prevention, in order:

1. Change the code or interface so the invalid state is hard to express (types, structure).
2. Add a type, lint rule, test, or boundary check that detects the failure deterministically — proven once per §6, recorded in the rejected/adopted list.
3. Add concise repository guidance for context tools cannot encode.
4. Request human review for decisions that need judgment or ownership — the last rung, not the first.

Rules grow from observed failures, not speculation. Architecture checks, nested instruction files, and multi-agent machinery are optional; add them when real complexity, repeated failure, or several contributors justify the maintenance cost.

### Gardening: how the guard set evolves

Prevention alone stops scaling once agents change the repo daily. Run a gardening loop: agents sweep periodically for banned patterns, dead code, and drift, queueing each finding as a small PR; triage the queue in batches every few days and change the bed — every pulled weed becomes a rule or a check so it cannot grow back. Review agent output by sampling, with the ability to revert, rather than reading every line: volume is only safe while quality holds, and sampling plus revert is what keeps it held.

## 14. Hardening pass (adopting an existing repo)

When pointed at an existing, unstructured repository, work this ladder in order — each rung makes the next safer:

1. **Trust/safety:** CI cannot silently pass; secrets out of the tree; auth and data integrity intact.
2. **Reproducibility:** install/build/test discoverable and canonical; formatter, linter, typecheck, tests; fix flaky tests before adding more.
3. **Architecture:** boundaries and cycles (§6), stricter types (§4), consistent errors.
4. **Deeper assurance:** browser tests, boot check in CI, perf budgets, audits — only after 1–3 hold.

Baseline existing failures separately from regressions, and never weaken a threshold to make an old failure disappear.

## 15. Definition of done

Acceptance criteria answer *did we build the right thing?*; verification answers *did we build it right?* — done requires both.

- Requested behavior and acceptance criteria satisfied.
- Relevant checks run, real outcomes known, runtime behavior exercised where feasible.
- Every rename or contract change complete, confirmed by whole-repository search; persisted data readable in both formats during migration.
- Generated output current (regen-diff clean); no hand-edited generated files.
- Diff scoped: no secrets, caches, dead code, or unrelated edits; docs invalidated by the change updated.
- Remaining risks, blocked checks, and follow-ups stated honestly.

Scale the checklist to the change. A trivial task needs no release pipeline; a high-risk task is not safe because its diff is small.

## 16. Final response

Match the length to the work: small change — one to three sentences with result and check outcome; feature-sized — summary, key decisions, checks table; foundational or audit — full structure with findings separated from hypotheses and recommendations labeled as proposed. Always state the outcome, decisions and assumptions, each check with its outcome, and unresolved risks.

## Anti-patterns (reject)

- Prose restating what a check enforces (lint leakage); instruction files that grow instead of shrink.
- Stacked overlapping guards (file-size + complexity + duplication linters all at once) — false-positive fatigue.
- Ratchets on greenfield; slow pre-commit hooks (they teach bypassing); permanent proof harnesses.
- Custom linters for failures never observed; re-adding a rejected guard without new evidence.
- Snapshot or hash machinery over contracts the compiler already proves (inferred monorepo contracts).
- Hand-writing shapes codegen owns; editing generated files.
- `any`, broad suppressions, skipped tests, weakened thresholds to satisfy a check.
- Oracle tests whose expected value merely restates the implementation.
- Flaky tests in agent loops; shared mutable test fixtures.
- Task lists without per-task acceptance criteria and a verification command; all-XL breakdowns; dependency order ignored.
- Big-bang migrations — prefer strangler-fig increments with dual-read cutover.
- Golden cages: pits of success with no escape hatch; enforcement where design could make the wrong thing inexpressible.
- Agents holding the owner's credentials; truncated instruction files; empty per-package instruction stubs.

## Operating rule

**Discover the real workflow. Structure for one-hop navigation, deep modules, and clear boundaries; make illegal states unrepresentable. Enforce the boundaries that matter with native tooling, messages that say how to fix them, proven once. Generate what a schema can generate. Verify real behavior through a named ladder, with exit codes you have inspected. Report evidence honestly.**

## Sources

- Revision 1's own principles (scale-to-work, one-hop navigation, rename ritual, honest evidence) — retained.
- `agent-ready-project` revision 2 (types-first defaults, deep modules, risk tiers, measurement, anti-patterns, bootstrap order) — absorbed in revision 3; that skill is retired.
- Oct 2026 research: philschmid.de and GitHub's 2,500-repo AGENTS.md analysis (context-file bloat hurts; commands + non-inferable knowledge is the value); flaviocopes.com and deployhq (slow hooks get bypassed — fast lint/format locally, real gates in CI); SE StackExchange and qlty.sh (stacked-linter false-positive fatigue); biomejs.dev v2 (nested configs, `noRestrictedImports`, multi-file `noImportCycles`); lightpanda.io and vercel-labs/agent-browser (lean browser verification stack).
- poteto × Matt Pocock interview and pstack: drive-the-app artifact and its maintenance, gardening loop, delegation-scales-with-verifiability, plan-through-code, decision log, sampling-plus-revert review.
- Addy Osmani, `planning-and-task-breakdown` (agent-skills collection): vertical slicing, task sizing and shape, risk-first checkpoints, plan home, parallelization rules — absorbed in revision 3.1.
- Field validation: Curves project ADRs 0001–0003 (Biome toolchain, lean guardrails, browser testing without heavyweight frameworks).
