---
name: codebase-architect
description: Design, scaffold, refactor, or audit a codebase so that agents and humans can find files in one hop, change them safely, and get fast, actionable feedback. Use for new project structure, folder reorganization, AGENTS.md or CLAUDE.md setup, architectural boundary rules, and renames or migrations that touch many files. Scale the structure to the project: small tasks need only the checks in sections 2, 9, and 13. Works across TypeScript, JavaScript, Python, Rust, Go, and game projects.
---

# Codebase Architect

## Mission

Produce a repository that is understandable, navigable, and safe to change, with structure proportional to the project's size, risk, and team. Principles are universal. Layout, tooling, and enforcement are chosen per project.

Two failure modes to prevent:

- **Wrong place, wrong layer.** Files land in the wrong folder, imports cross layers, and generic dumping grounds grow.
- **Unverified change.** A rename or edit misses a site, a migration breaks stored data, or a passing check did not actually run.

## 1. Scale the process to the work

Classify the request first. The highest signal that applies sets the tier.

- **Foundational:** a new project layout, a folder reorganization, a rename or contract change across modules, a persisted-data format change, auth or sensitive data, or a decision that is hard to reverse. Write a plan (section 7) and enforce boundaries mechanically (section 4).
- **Feature-sized:** new user-visible behavior spanning more than one module. Clarify acceptance criteria, check affected boundaries, implement in increments, and verify the workflow.
- **Small or localized:** one bounded change inside one module, with no contract change. Inspect context, change it, run the narrowest check, and summarize in one or two sentences. Do not create a plan or new guardrails.

If the work grows, reclassify and say so. A small diff does not excuse skipping a check on data integrity or security that the change touches.

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
- **No barrel files** (`index.ts` re-exports) where they hide the true import path, because they break static tracing and dead-code analysis. Import concrete modules directly.
- **One-way dependencies.** Transport (routes, API handlers, components) calls services. Services call repositories and pure calculation modules. Repositories call the database client. Lower layers never import upward.
- **Contract-only cross-feature imports.** A feature may import another feature's public schema or contract, never its services, repositories, or internal components. If two features need the same behavior, move it into a service that orchestrates both, or into `shared/`.
- **Split `shared/` by capability**, such as `shared/kernel` (universal types), `shared/calc` (pure logic with no I/O), `shared/telemetry`, and `shared/ui` (frontend only). Never mix backend logic and UI helpers in one folder.
- **File size as a review trigger.** Use 400 lines as the default threshold for review, not a hard rule for every project. Split a file when splitting makes it easier to read. Tiny files that only re-export or hold one trivial function add tool calls without value.

### Example layout (TypeScript web app, illustrative)

```
src/
  features/
    boards/
      boards.schema.ts      # public contract, the only file other features may import
      boards.service.ts
      boards.repo.ts
      boards.api.ts
      boards.service.test.ts
      components/
      AGENTS.md             # optional, under 30 lines, only for real domain invariants
    cards/  ...
  shared/
    kernel/  calc/  telemetry/  ui/
  server/
    db/                     # the only place the database client is created
docs/
  ARCHITECTURE.md  DB_SCHEMA.md  ADR/
AGENTS.md  CLAUDE.md -> AGENTS.md
scripts/lint-architecture.mjs
```

A Python or Rust project keeps the same principles with its own conventions (packages, modules, crates). Derive the layout from the project; do not copy this one.

### Decision and vocabulary records

Record an architecture decision (ADR) only when its reasons or rejected alternatives would be hard to rediscover. Keep it short. Use consistent domain terms in names and tests. A glossary is optional and only useful when naming confusion causes real coordination problems.

## 4. Make boundaries mechanical

Prose rules drift under context pressure. For each boundary the project actually depends on, add a check that runs in one command.

- **Self-healing messages.** Each violation message states its error code, the rule broken, the location, and a `Remediation:` line saying how to fix it without guessing.
- **Prefer a parser over regex** for import rules. Parse the whole file, not single lines, so multi-line, dynamic, and re-export imports are seen.
- **Test the checker** on at least one violating and one legitimate example before trusting it.

A reference checker ships in `scripts/lint-architecture.mjs` (zero dependencies, Node 18+). Its tests are in `scripts/lint-architecture.test.mjs`, run with `node --test scripts/`. Its known limits are in its header: it strips comments lexically and cannot resolve runtime-built import paths. It can also flag an import-shaped string literal, which is a visible false positive rather than a silent miss. For other stacks, adapt the rules to that ecosystem's parser (for example, `go vet` plus a custom analyzer, or `cargo` features and crate boundaries for Rust).

Add a check only for boundaries that matter. Common candidates are cross-feature imports, UI imports in backend code, database clients imported outside repositories, and barrel files. Do not add every rule by default.

## 5. Context routing for agents

Keep the root instruction file short, so every session starts with useful context and not noise.

- **Root `AGENTS.md`, under 80 lines.** Contains the project purpose, the single-file test command, the typecheck, lint, architecture, and full-gate commands, the placement rules, and a routing table to `docs/` and feature folders.
- **`CLAUDE.md`** is a symlink to `AGENTS.md` (`ln -s AGENTS.md CLAUDE.md`) or contains only `@AGENTS.md`, so all agents share one source.
- **Scoped `AGENTS.md` files** inside a feature or shared folder, under 30 lines, only for invariants that apply there, such as integer-cent currency rules or token-hashing rules.
- **On-demand `docs/`** for architecture, the database schema, and ADRs. Agents load these when the routing table points to them.

Do not duplicate lint rules in prose, and do not keep several instruction files that can drift apart. Keep only context that cannot be inferred from code or config. Check after installing agent plugins or skills that nothing has been cloned into the repository root.

### Root `AGENTS.md` template

```markdown
# AGENTS.md

## Purpose
<one paragraph>

## Commands (run scoped first)
- Single test: `<exact command for one test file>`
- Typecheck: `<command>`
- Architecture and size: `<command>`
- Full gate before PR: `<command>`

## Placement rules
1. Features live in `src/features/<domain>/`. Each owns its schema, service, repo, api, and tests.
2. Dependencies flow one way: routes/components -> api -> service -> repo -> db client.
3. Cross-feature imports: only another feature's `.schema` or `.contract` file.
4. No barrel files. No `utils`, `helpers`, or `common` filenames.
5. Pure logic goes to `src/shared/calc/`. Database client only in `src/server/db/` and repo files.

## Routing (read on demand)
- Architecture and layers: `docs/ARCHITECTURE.md`
- Database tables and invariants: `docs/DB_SCHEMA.md`
- Decisions and rejected options: `docs/ADR/`
- Domain invariants: `src/features/<domain>/AGENTS.md`
```

## 6. Establish a baseline that stays reproducible

Where applicable, establish canonical commands for formatting, linting, type checking, unit and integration tests, build, run, and dependency installation with a lockfile. Avoid duplicate or conflicting commands and placeholder commands presented as real ones. A clean checkout should reproduce the setup.

Validate required configuration at startup so failures are clear. Validate untrusted input at runtime boundaries even when static types exist. Keep secrets out of source control and grant CI jobs least privilege.

### Dependencies

Add a dependency only with a clear benefit that would be costly to implement. Check maintenance activity, known vulnerabilities, license compatibility, whether an equivalent is already in the tree, and whether the lockfile pins it.

### Ignore rules and staging

Make sure `.gitignore` covers caches, build output, local databases, and agent tool directories. Before committing, stage explicit paths (`git add <file>`), review `git diff --cached --name-only`, and confirm no generated files are included. Avoid `git add -A` unless `git status` has been reviewed.

### Hooks and CI

Put fast, deterministic checks in pre-commit hooks only when they stay fast and reliable. Put expensive integration, end-to-end, and release checks in CI. A written rule is not enforcement.

## 7. Plan foundational work and protect existing work

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

### Renames, contract changes, and migrations

Before editing any rename, field, key, signature, or contract:

1. **Enumerate every reference across the whole repository**, including tests, fixtures, persisted data, configuration, string keys, log and format strings, and documentation. Do not limit the search to one folder. Save the list as a checklist with one line per site.
2. **Edit each site explicitly** or with a language-aware rename tool. Do not use a global text replacement. It silently changes unrelated occurrences and intentional fallbacks.
3. **Dual-read before switching writers.** Make readers accept the old and new formats first. Then switch writers. Then migrate stored data. Keep the fallback until no old data remains, and say when it can be removed.
4. **Re-run the whole-repository search.** Each remaining hit must be on the checklist as intentionally kept.

### Splitting work

Split a task when its acceptance criteria are unclear, it crosses independent concerns, its verification loop is too broad, or parallel work would conflict. Use the repository's existing plan or issue convention. Before writing plan state, inspect existing plans. Never overwrite an unrelated incomplete plan or delete uncommitted work.

## 8. Implement in small, reviewable steps

- Keep changes bounded. Do not bundle unrelated refactors.
- Handle relevant failure paths and edge cases, not only the happy path.
- Preserve public behavior and compatibility unless a breaking change is intended and documented.
- Add a regression test for each confirmed bug when practical. Prefer tests that fail before the fix.
- Tests must not write to real data, shared directories, or the user's home. Use temporary paths and reset state between tests.
- Update docs, examples, and configuration that the change makes inaccurate.

## 9. Verify real behavior

Start with the narrowest meaningful check and widen by risk:

1. A targeted test, static check, or direct reproduction.
2. Relevant unit and integration tests, plus typecheck and lint.
3. The build or packaging step the change requires.
4. A runtime or workflow smoke test for user-visible or integration behavior, when feasible.
5. Broader regression checks for the scope.
6. A review of the full diff and actual command output.

Adapt the checks to the system. Web: exercise the browser flow and check console and network errors. API: make representative requests and check responses, persistence, authorization, and failure paths. CLI: run real commands with valid and invalid input and check exit codes. Mobile: use a simulator or device, since a compile does not prove an interaction works. Library: test consumer-facing imports and types.

### Recording results honestly

Record the real exit code of each check. A pipeline such as `cmd | tail` reports the status of the last command, which can hide a failure. Run the check alone, or use `set -o pipefail`. Confirm the run executed the expected number of tests; a run that collects zero tests is a failure of the check. Report each check as **passed**, **failed**, **not run**, or **blocked**, and never claim a check passed without inspecting its result.

### When the environment cannot run the system

Run every check the environment supports, such as static checks and unit tests. Report the rest as **blocked**, name the missing resource, and give the exact command the user should run. Do not describe the change as verified end to end.

## 10. Turn repeated mistakes into guardrails

When a mistake repeats, choose the least costly reliable prevention, in order:

1. Change the code or interface so the invalid state is hard to express.
2. Add a type, lint rule, test, or boundary check that detects the failure deterministically.
3. Add concise repository guidance for context tools cannot encode.
4. Request human review for decisions that need judgment or ownership.

Architecture checks, nested instruction hierarchies, and multi-agent workflows are optional. Add them when real complexity, repeated failure, or several contributors justify the maintenance cost.

## 11. Definition of done

- Requested behavior and acceptance criteria are satisfied.
- Relevant checks were run and their real outcomes are known.
- Runtime behavior was exercised where feasible.
- Every rename or contract change is complete, confirmed by a whole-repository search.
- Persisted data is readable in both old and new formats during any migration.
- The diff is scoped, with no accidental secrets, caches, dead code, or unrelated edits.
- Documentation invalidated by the change is updated.
- Remaining risks, blocked checks, and follow-up work are stated honestly.

Scale this checklist to the change. A trivial task does not need a release pipeline, and a high-risk task is not safe because its diff is small.

## 12. Final response

Match the length to the work:

- **Small change:** one to three sentences with the result and the check outcome.
- **Feature-sized change:** a short summary, key decisions, and a table or list of checks.
- **Foundational change or audit:** the full structure, with confirmed findings separated from hypotheses and recommendations labeled as proposed.

Always state the outcome, important decisions and assumptions, each check with its outcome, and unresolved risks. Include commands or evidence only when they help the reader decide.

## Operating rule

**Discover the real workflow. Structure for one-hop navigation and clear boundaries. Enforce the boundaries that matter, with messages that say how to fix them. Plan changes in proportion to risk. Enumerate before renaming. Verify real behavior, with exit codes you have inspected. Report evidence honestly.**
