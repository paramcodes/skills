---
name: agent-ready-project
description: Bootstrap or harden any new (or existing) repository so AI coding agents can navigate it, make constrained changes, and self-verify — with the correct path as the path of least resistance. Use at the start of a new project, when scaffolding, or when "set this up for agents", "make this agent-ready", "pit of success", "golden path", "paved road". Covers stack detection, safe defaults, deep modules, generated contracts, self-explaining ratcheted guards, verification tiers, navigability artifacts, checked rules, and risk-tiered autonomy.
---

# Agent-Ready Project Bootstrap

Goal: a repo where an agent can **find → understand → change one bounded area → verify → stop when authority is insufficient**, and where the **easy thing is the right thing**.

Core thesis: agents follow the path of least resistance more aggressively than humans. Do not fight that — *shape* it. Deterministic guardrails (types, lint, tests, CI) beat prose rules: context files cost >20% extra inference, 62% of repos restate what their linter already enforces, and instruction files regrow ~91.5% of their size within 10 commits of a rewrite.

## When to use

- New project scaffolding / "set this up for agents".
- Existing repo feels unnavigable or agents keep making the same mistakes.
- Before scaling AI-generated code (tests/gates must exist first).

## Operating rules (non-negotiable)

1. **Inspect before prescribing.** Detect stack, manifests, lockfiles, CI, existing conventions. Never invent commands.
2. **Smallest useful slice.** No repo-wide rewrites or formatting churn.
3. **Preserve existing work.** Check `git status`; never overwrite uncommitted changes or replace configs wholesale.
4. **Gates honest.** No `|| true`, skipped tests, swallowed failures, weakened thresholds.
5. **Prove guardrails fail.** Show the bad pattern fails; restore; show pass. A check never seen failing isn't trusted.
6. **Evidence not claims.** Report what ran, passed, failed, or couldn't run.

## Phase 0 — Detect (do not ask)

Read: README, manifests, lockfiles, test layout, CI, existing agent instructions, architecture docs. Derive: language/framework/version, package manager, monorepo boundaries, DB presence, test runner, deploy sensitivity. Ask only what cannot be detected (see Phase 1).

## Phase 1 — Ask only four things (batched)

1. Who owns the rule table / which team may change it? (handle → CODEOWNER)
2. Which detected facts should become rules? (list with evidence; accept/reject)
3. What's heavy on this machine, and which commands count as heavy? (core count + names)
4. Any rule from project history the detector can't see? (free text)

## Phase 2 — Safe defaults by construction (types)

Make illegal states unrepresentable. Apply to the project's language:

- **Strictness:** TS `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`; Python `mypy --strict`/pyright; Rust default (no `unsafe` without justification); Go errcheck/vet.
- **Branded semantic primitives:** `type UserId = string & { __brand: "UserId" }` so wrong id won't compile.
- **Typed errors:** domain error classes (`NotFoundError`, `ValidationError`, `DomainError`), never `new Error()` / bare strings.
- **Parse at boundaries:** zod/valibot/pydantic at HTTP/DB/CLI edges; trust internal types; no defensive re-checks internally.
- **Exhaust variants:** exhaustive switch/match with compile-time exhaustiveness.
- **Derive from authoritative schemas:** DB schema/types as source of truth.
- **Default-safe posture:** params local/immutable/non-null by default; every cost (heap, mutability, sharing, async, nullability) explicit opt-in.
- **No `any`/broad suppressions** added to satisfy a check.

## Phase 3 — Deep modules at clean seams

Design for **locality** (change one area) and **blast radius** (small edits, small regressions):

- Module = interface + implementation. Aim **deep**: small interface, lots of behavior behind it.
- Accept dependencies, don't create them (`processOrder(order, gateway)` not `new StripeGateway()`).
- Return results, don't mutate inputs (`calculateDiscount(cart): Discount`).
- Small surface area: fewer methods/params = fewer tests.
- Seam = where behavior can change without editing there. One adapter = hypothetical seam; two adapters = real seam. Don't introduce speculatively.
- Deletion test: if deleting the module makes complexity reappear across N callers, it earned its place.
- Draw explicit dependency direction; direct acyclic dep through a public contract beats a new event bus. Events add delivery/ordering/idempotency/observability obligations.
- Shared code must be genuinely shared, not a dumping ground for disputed types.

## Phase 4 — Generated contracts (no drift)

Anything derivable from a schema is generated, never hand-written:

- Schema = single source of truth (OpenAPI/GraphQL/protobuf/DB).
- Commit generated output so agents read real types on any checkout.
- Banner every generated file with a greppable marker: `// GENERATED FILE — DO NOT EDIT. Run <cmd> to regenerate.`
- Gate in CI: regen-diff (output matches schema) + breaking-change check vs published schema.
- State in `AGENTS.md`: import generated types; never hand-write an API shape codegen owns.

## Phase 5 — Deterministic guardrails (both hook AND CI)

A rule an agent must remember is a suggestion; an exit code is a contract. Wire every check into **both** pre-commit (lefthook/husky) **and** CI (hooks aren't guaranteed installed; CI alone is too late).

Tool categories (swap per ecosystem; categories are language-agnostic):

| Category | TS example | Catches |
|---|---|---|
| Dead code / unused exports & deps | `knip` | Orphaned helpers agents leave behind |
| Copy-paste duplication | `jscpd` | Near-duplicates that should share impl |
| Import boundaries & cycles | `dependency-cruiser` / eslint `boundaries` | Layer violations (handler/service/dao) |
| File size & complexity | eslint `max-lines` (~400), `complexity` | Files too big to read in one pass |

**Bespoke invariant guards with a ratchet** (for rules generic linters can't express: "DAOs never import handlers", "no `as unknown as` double-casts"):

1. Self-explaining failures: print *why* the invariant exists and *how to fix*, not just where. Agent self-corrects on the spot.
2. Shrink-only baseline: pre-existing violations in a committed baseline file (JSON). Guard passes while violations ≤ baseline, fails when they grow. New rule enforces repo-wide day one; migration incremental. Fix violations; **never edit baseline upward**.
3. Graduated enforcement: warn-only variant in pre-commit for fast signal; blocking variant in CI.

Guard shapes worth copying:
- Registry completeness as reflection test: reflect over real code; fail when item missing from registry/allowlist. Nothing added without declaring it.
- Deprecation greps: removed APIs must not reappear in active code/docs; each hit prints sanctioned replacement. Exclude changelogs (historical record).
- Boundary-lint messages name the rule + link the architecture doc.

**Architecture as executable tests:** ts-archunit (TS) / ArchUnit (JVM) rules with `because` + `suggestion` fields producing `Architecture Violation [id] … Why … Fix …`.

## Phase 6 — Verification tiers + boot check

Name tiers and publish routing so agents run the cheapest relevant one:

- `check` = lint + typecheck
- `verify` = check + unit tests
- `verify:full` = verify + integration + boot checks

Conventions:
- Test filename conventions with latency budgets (`*.test.ts` <3s, `*.integration.test.ts` <10s, `*.e2e.test.ts`).
- **Boot check:** construct app wiring (DI container, module graph, route registration) without serving traffic. Catches wiring errors typecheck+unit miss — exactly what agents introduce when adding a dependency.
- `.env.example` = canonical env contract; boot check loads it; new var lands there or CI fails.
- File-scoped variants (typecheck/lint/test one file) — fastest loop.
- Deterministic, parallel-safe tests: unique IDs per test (never shared fixtures), seeded randomness, frozen-clock helper.
- Pluggable interfaces ship a behavioral spec as an importable contract test suite, so a new adapter (often agent-written) proves conformance by calling one function.

## Phase 7 — Navigability artifacts (progressive disclosure)

Agents assemble understanding layer by layer. Provide maps, not encyclopedias:

- Root `AGENTS.md` as **table of contents** (not encyclopedia), ≤ ~250 lines / ~500 tokens. Contents: repo overview, setup/command lines, validation ladder, definition of done, pointer to rule table. **Not** the rules themselves.
- Nested `AGENTS.md` per package, holding only that subtree's additions; don't repeat parent wording.
- Repository map pointing task → owning module → contract tests.
- Root + local instruction contract: root defines repo-wide rules (clean baseline, package manager, restricted paths, security handling, evidence format); local defines only genuine differences (focused command, owner, compat constraints).
- Scoped guides under `docs/` for deep procedures; root links to them.
- Restricted paths declared explicitly (`infra/**`, `services/payments/**`, `.env*`) — and enforced by sandbox/CI, not just stated.

**Navigability characteristics to protect (from maintainable.software):** locality, blast radius, boundary integrity, navigability, rebuild/test scope. Diagnostic: can a new agent find the relevant behavior, change one bounded area, and run the smallest meaningful verification loop without guessing?

## Phase 8 — Checked rules, not trusted prose (optional but recommended)

A rule is only real when a mechanism acts on it. Set up when ≥2 agents work in parallel:

- Rule table: `docs/ai/rules/*.yaml`, one file per rule. Fields: `id`, `layer` (type/primitive/runtime/test/lint/ci/prose), `enforced_by` (path + marker), `artifact`, `failure`, `owner`.
- Auditor (`scripts/audit-rules.*`): deterministic; fails on missing path/marker, no artifact, no failure, contradictions, unprotected paths. Never edits, never needs a model.
- Projector (`scripts/sync-agent-rules.*`): generates thin instruction file, CODEOWNERS, protected-path table; check mode fails on hand-edits.
- Context file (`docs/ai/context.yaml`): orientation facts (branch, queue, merge policy), not constraints.
- Marker discipline: marker must be specific enough that deleting the mechanism takes the marker with it (avoid `bun run test` matching `bun run test:e2e`); use marker lists when one can't scope.
- Failure discipline (strike system): strike 1 = fix locally + note in commit; strike 2 = change shape of code so can't recur (rule points at new shape); strike 3 = write lint/hook forbidding it. Rule rarely needs new code by strike 2.
- Ownership: CODEOWNERS on rules file, table, workflows, hooks, token source, CODEOWNERS itself; branch protection (PR + approving review + code-owner review + approval of latest push). Give agents a token **without** write access to protected paths (credential problem otherwise).

## Phase 9 — Two checks that earn their keep

1. **Oracle:** a test whose expected value came from the same prompt as the code repeats the code's mistakes. Assert on a value the agent couldn't invent, hold the oracle in a file the agent doesn't own, or verify against the real thing.
2. **Runtime surface:** a change isn't done because a test passed. Done when the touched surface is observed in the running app — route driven in a real browser, query run against the real DB, process started with config and logged its resolved target. DOM assertions pass on pages a human can't read; only a screenshot/bounding box shows.

## Phase 10 — Autonomy boundaries (risk tiers)

Separate actions by risk (from opatsay):

- **Low:** read repo, local search, run unit tests, scoped code changes.
- **Medium:** deps updates, migrations, network access, generated code, CI config.
- **High:** production, secrets, destructive operations.

A mature system makes explicit where autonomy ends. A perfectly valid agent output may be a **plan + request for confirmation**, not a finished commit. Protect CI workflows, quality config, security policy, deployment controls from casual changes; don't change branch protections/hosting settings unless explicitly authorized.

## Phase 11 — Measurement & iteration

Optimize three numbers (Trilogy): **success rate** (mid–high 90s or frustrating), **wall clock**, **expense**. They're interrelated (more tokens → higher latency+cost; tool calls dominate or negligible). Requires scalable, repeatable, cheap tests first. Levers: model selection (smart enough, not too smart — test on model that does simplest version ~99%), harness (minimal sufficient tools, compel forward motion, protect from context overload), agentic UX (progressive disclosure, self-explaining errors, targeted corrections). Iterate: measure → change one thing → measure.

## Phase 12 — Bootstrap sequence (do in this order)

1. Establish baseline: `git status`, run smallest relevant pre-existing checks, record baseline failures separately (not regressions).
2. Prioritize by risk/leverage: P0 trust/safety (secrets, CI can't silently pass, auth/data integrity) → P1 reproducibility/correctness (install/build/test discoverable, formatter/linter/compiler/tests, regression coverage, fix flaky) → P2 architecture (boundaries, circular deps, stricter types, consistent errors) → P3 deeper assurance (E2E, mutation, perf budgets, audits).
3. State 3–7 highest-value findings + intended small slices (risk, durable fix, verification method).
4. Implement in small slices: identify rule/failure, one coherent change, native/standard tool, update canonical verification interface + CI, verify guardrail passes on legit code and fails on bad pattern, review diff for unrelated noise/suppressions.
5. Establish portable repo contract: concise root `AGENTS.md`, canonical tasks (`verify-fast`, `verify-all`, targeted), long procedures in focused docs.
6. Make CI a trustworthy merge gate: same canonical commands, fail clearly, separate quick/full/expensive, stable actionable names, preserve reports/traces/screenshots/logs, visible baseline for pre-existing failures, avoid brittle absolute coverage thresholds (prefer meaningful tests for critical paths).
7. Verify actual behavior (evidence appropriate to change type; feature map for user-visible apps).
8. Final review: `git diff --check`, complete diff, configs, exceptions/deps; re-run affected checks; verify tests not removed/skipped/weakened; report what changed + risk, commands run + results, pre-existing failures + checks that couldn't run, residual risks + next 3 priorities.

## Done means

Repo is measurably easier to change and verify; new guardrails actionable and actually run; diff scoped; another agent can discover how to use checks without private context from this session. Do **not** claim "agent-proof" or "secure" merely because checks pass.

## Anti-patterns (reject)

- Prose rules restating linter output (lint leakage).
- Big-bang migrations; prefer strangler fig with incremental rollout.
- Golden cages (rigid, no escape hatch).
- Pit of success with no escape hatch.
- Enforcement over design (blocking at review is a gate; pit-of-success makes wrong behavior impossible to express at authoring time).
- Oracle tests (expected value from same prompt as code).
- Flaky tests in agent loops.
- Hand-written API shapes codegen owns.
- Truncated/silently-truncated instruction files.
- Agent with owner's credentials.
- `any`, broad suppressions, ignored warnings, skipped tests, weakened thresholds to satisfy a check.
- Custom linters for rare edge cases without documented failure mode + test.

## First prompt to give a fresh agent (paste at project start)

> Bootstrap this repository as agent-ready using the `agent-ready-project` skill. Phase 0 detect the stack first (no assumptions). Phase 1 ask the four batched questions. Then execute Phases 2–12 in order, smallest useful slice per phase, with a git commit per slice. Prove each new guardrail fails on a bad pattern before restoring. End with a report: what changed + risk, commands run + results, pre-existing failures + checks that couldn't run, residual risks + next 3 priorities. Do not claim "agent-proof".

## Installation

- **Global (all projects):** save as `~/.config/opencode/skills/agent-ready-project/SKILL.md` (create dir if needed).
- **Project-local:** save as `<repo>/.opencode/skills/agent-ready-project/SKILL.md`.
- Invoke: `skill` tool with `id: "agent-ready-project"`, or `/agent-ready-project` if your harness supports slash. Frontmatter `name:` must equal the directory name.

## Sources

- Make the Easy Path the Right Path (Pragmatic DX) — pit of success, golden path, paved road.
- Trilogy: Pit of Success for agents — measurement, levers.
- maintainable.software: Agentic Codebase Principles — navigability, rebuild/test scope, progressive disclosure.
- Agent-Navigable Repositories (Optimi) — layered instructions, enforcement elsewhere.
- mblode agent-friendly-codebase reference — deterministic guardrails, ratchet, generated contracts, verification tiers.
- ts-archunit — architecture guardrails for agents.
- opatsay: agent-ready codebase — risk-tiered autonomy, five-step reliability.
- Agent-Ready Engineering Infrastructure (Agent Grove) — six layers.
- PlanVault ai-engineering-playbook — testing/verification ladder, CI gates.
- design-pit-of-success reference (rjmurillo) — agents follow easiest path more aggressively.
- Martin Fowler micro-frontends — pit of success via thicker lines around bounded contexts.
- Local skills: agent-ready-codebase, agent-ready-harness, agent-rules, codebase-design.