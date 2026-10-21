---
name: agent-ready-codebase
description: Audit, harden, or continuously improve a software repository so coding agents can modify it reliably across harnesses. Use when setting up a new project for AI agents, improving code quality or CI, creating lint and architecture rules, reducing recurring agent mistakes, or making verification dependable.
license: MIT
metadata:
  version: "1.0.0"
---

# Agent-Ready Codebase

Turn the current repository into a codebase where mistakes are difficult to introduce, easy to detect, and cheap to diagnose. This skill is a repeatable engineering workflow—not a request to install every possible tool.

## Operating principles

1. **Inspect before prescribing.** Base recommendations on the actual stack, project structure, existing conventions, and current failures.
2. **Improve the repository, not just the prompt.** Prefer architecture, types, schemas, tests, lint, scripts, and CI over adding another paragraph of agent instructions.
3. **Make the smallest useful improvement.** Avoid a large rewrite, a repository-wide formatting churn, or introducing a new framework merely to satisfy a checklist.
4. **Preserve existing work.** Inspect `git status` and the diff before editing. Do not overwrite uncommitted work or replace project configuration wholesale.
5. **Make gates honest.** No skipped required checks, swallowed failures, `|| true`, fake-success scripts, or weakening a rule just to get green CI.
6. **Be stack- and harness-agnostic.** Reuse the project's tools where reasonable. Keep policy and commands in version-controlled files; use harness-specific files only as thin adapters.
7. **Distinguish evidence from claims.** Report exactly which checks ran, passed, failed, or could not run. A build passing does not prove the product workflow works.
8. **Risk-based autonomy.** Make reversible, local, low-risk improvements. Do not deploy, publish, contact external services, rotate credentials, run production operations, or perform destructive migrations. Seek explicit approval before irreversible or high-impact actions.

## Default mode

Unless the user explicitly asks for an audit-only report, **inspect and then implement high-value improvements**. Do not stop after producing a long list of recommendations. Work in small, verifiable slices. If the repository is too large for a full transformation in one session, complete the highest-value coherent slice and leave a prioritized, evidence-based backlog.

## Workflow

### 1. Establish the baseline

- Identify the repository root and inspect `git status --short` and existing diffs. Do not revert the user's changes.
- Read the README, package/build manifests, lockfiles, test layout, CI configuration, existing agent instructions, and architecture documentation.
- Run `scripts/audit_repo.py` from this skill against the repository if available. Treat its output as a file/configuration inventory, not a semantic code review.
- Discover the repository's *actual* setup, lint, type-check, test, build, and integration-test commands from manifests and CI. Never invent command names and claim they exist.
- Run the smallest relevant pre-existing checks where safe. Record baseline failures separately so they are not misrepresented as regressions.
- Detect the stack, project size, monorepo boundaries, deployment sensitivity, and whether the repo is new or contains legacy debt.

### 2. Prioritize by risk and leverage

Choose a few improvements, in this order where relevant:

**P0 — Trust and safety**
- Protect secrets and sensitive data; inspect existing secret-handling conventions.
- Ensure required CI failures are visible and cannot silently pass.
- Preserve authentication, authorization, data integrity, and production/deployment controls.

**P1 — Reproducibility and correctness**
- Make install/build/test commands discoverable and reliable on a clean checkout.
- Ensure appropriate formatter, linter, compiler/type checker, and tests run locally and in CI.
- Add regression coverage for known bugs and validation at untrusted boundaries.
- Fix flaky or misleading checks before adding more gates.

**P2 — Architecture and maintainability**
- Enforce meaningful module/import boundaries and detect circular dependencies.
- Use stricter type safety and consistent error handling where they fit the language.
- Address recurring complexity, duplication, and inconsistent patterns with measurable rules.
- Write concise, repository-specific agent instructions and architecture notes.

**P3 — Deeper assurance**
- Add targeted end-to-end tests, mutation testing, performance budgets, dependency audits, supply-chain checks, or observability checks when the project's risks justify the cost.

Do not apply every item automatically. Pick checks that have a clear failure mode and fit the stack. Prefer mature, maintained tooling over a custom lint implementation unless a concrete recurring project-specific mistake is not covered otherwise.

### 3. State a short implementation plan

Before broad changes, summarize the 3–7 highest-value findings and the intended small slices. Each item should name the risk, proposed durable fix, and verification method. Proceed with reversible improvements without asking for approval for every small choice. Do not turn the plan into a substitute for implementation.

### 4. Improve in small slices

For each slice:

1. Identify the rule or failure the change is intended to address.
2. Make one coherent change; preserve existing conventions where sound.
3. Prefer a native or standard tool for the language/framework.
4. Update the canonical local verification interface and CI only as needed.
5. Verify the guardrail itself: show that the legitimate project passes, and, when practical, prove the targeted bad pattern would fail.
6. Review the diff for unrelated changes, generated noise, suppressed diagnostics, and weakening of checks.

Examples of high-value durable fixes:
- Replace a recurring prompt instruction with a type, schema, test, lint rule, or import boundary.
- Add one dependable command that runs the repository's real checks instead of inventing several overlapping scripts.
- Make CI use the same canonical commands developers and agents use locally.
- Add a regression test before or alongside a bug fix.
- Make test and setup failures fail closed, with errors that name the command and failing boundary.

### 5. Rules for lint, types, and architecture

- Start from the project's current stack and config. Merge changes; do not replace working configs wholesale.
- Enable strict or safer compiler/type-check options when compatible, then remediate problems by risk rather than hiding them.
- Favor high-signal correctness rules: unhandled async work, unsafe boundary casts, unused code, inconsistent error handling, and non-exhaustive state handling where supported.
- Set complexity/file/function limits only as contextual heuristics. Check the current baseline, generated files, and legitimate exceptions. Start with a warning or changed-code policy if existing debt is large; do not create thousands of unrelated failures.
- Enforce real module boundaries and circular-dependency rules when the architecture benefits from them.
- Avoid blanket bans on comments, abstractions, dependencies, or long files. Prefer rules with a demonstrated failure mode and actionable messages.
- Never add `any`, broad suppressions, ignored warnings, skipped tests, or weakened thresholds as a way to satisfy a check.
- Do not create arbitrary custom linters for rare edge cases. If a custom rule is justified, document what it prevents and include a test for the rule.

For more detail, read [the quality rubric](references/quality-rubric.md) and [CI contract](references/ci-contract.md).

### 6. Establish a portable repository contract

- Create or carefully update a concise root `AGENTS.md` if the repo has no good shared agent instructions. Start from [the template](assets/AGENTS.template.md), then replace generic examples with true project facts.
- If the project uses a different canonical instruction file, preserve it and avoid needless duplicates. A small harness-specific file may point to shared instructions if that host requires it.
- Document actual commands and module boundaries; do not leave placeholder commands or pretend unsupported guarantees exist.
- Prefer a small set of canonical tasks such as `verify-fast`, `verify-all`, and a targeted feature/test command, implemented in the project's natural task runner (npm scripts, Make, just, Task, tox/nox, etc.). Do not add wrappers that only duplicate existing commands.
- Put long procedures in focused docs/skills and keep the root instructions short enough to be scanned quickly.
- When the repository needs to prove its own agent-readiness, use the `agent-ready-harness` skill. It scores the criteria, proves each guardrail still bites, and turns a rule that broke into a permanent check.

### 7. Make CI a trustworthy merge gate

- Reuse the same canonical commands as local verification.
- Fail clearly if required tools, dependencies, or tests are unavailable; never convert an infrastructure failure into a pass.
- Separate quick feedback from full pull-request checks and expensive scheduled/risk-based checks when useful.
- Make check names and diagnostics stable and actionable. Preserve test reports, traces, screenshots, or logs when these help diagnose failures.
- Protect CI workflows, quality configuration, security policy, and deployment controls from casual changes. Do not change branch protections or repository hosting settings unless explicitly authorized and the necessary tools are available.
- If the project has existing baseline failures, do not silently hide them. Establish a visible baseline or changed-code policy and ensure new regressions remain blocking.
- Avoid brittle absolute coverage thresholds unless the project can sustain them. Prefer meaningful tests for critical paths and trend-based improvements.

See [CI contract](references/ci-contract.md).

### 8. Verify actual behavior

Choose evidence appropriate to the change:

- Library or domain change: focused unit tests plus integration tests for relevant contracts.
- API/backend change: request-level tests covering valid input, invalid input, authorization, error behavior, and persistence when relevant.
- UI change: exercise the changed user flow with existing browser/e2e tooling or a documented manual procedure when automation is unavailable.
- Migration: validate schema and data behavior in a disposable/local environment; do not run it against production.
- Performance change: compare a representative workload against a known baseline.
- Infrastructure/CI change: validate workflow syntax/configuration and inspect the effective diff; run a safe representative check when possible.

For user-visible applications, maintain a compact feature map that states the entry point, preconditions, important success/error/empty/cancel paths, and observable evidence. Update it with behavior changes. Use focused feature files rather than loading a huge checklist for every task.

Never claim browser, integration, mutation, security, or performance verification unless it actually ran and produced evidence. A passing unit suite or a successful compile is not proof of end-to-end correctness.

### 9. Final review and report

- Inspect `git diff --check`, the complete diff, changed configs, and any newly introduced exceptions or dependencies.
- Re-run the checks affected by the change. Run broader checks when practical.
- Verify that tests/checks were not removed, skipped, weakened, or made conditional in a way that hides failure.
- Summarize:
  1. What changed and which risk each change addresses.
  2. Commands/checks actually run and their results.
  3. Pre-existing failures and checks that could not run.
  4. Important residual risks and the next 3 priorities.
- Keep facts and recommendations distinct. Do not say the repository is “agent-proof” or “secure” merely because checks pass.

## Done means

The repository is measurably easier to change and verify; new guardrails are actionable and actually run; the diff is scoped; and another agent can discover how to use the checks without relying on private context from the current session.
