---
name: agent-ready-typescript
description: Apply and maintain high-signal TypeScript quality defaults in Node.js or browser repositories. Use when scaffolding a TypeScript project, tightening TypeScript, ESLint, formatting, tests, architecture boundaries, or CI; adapt templates to the existing framework rather than copying them blindly.
license: MIT
metadata:
  version: "1.0.0"
---

# Agent-Ready TypeScript

Use this skill as the TypeScript-specific companion to `agent-ready-codebase`. It supplies adaptable defaults, not a framework mandate and not permission for a broad rewrite.

## Outcomes

A project should have:
- Explicit TypeScript compiler guarantees suited to its runtime.
- High-signal ESLint checks, including type-aware async safety.
- One formatting convention and one discoverable verification workflow.
- Tests for important behavior and regression cases.
- Architecture checks where module boundaries are real and valuable.
- CI that uses the same required commands as local development.
- Repository instructions that state actual project commands and constraints.

## Workflow

### 1. Discover the actual stack before editing

- Check `git status` and existing diffs; preserve all uncommitted work.
- Inspect `package.json`, the lockfile, package-manager metadata, Node/runtime version, workspace layout, framework config, all `tsconfig` files, ESLint/formatter config, test config, CI workflows, and existing agent instructions.
- Identify whether this is Node ESM, CommonJS, a browser/bundler app, React/Vite, Next.js, a library, or a monorepo. Do not assume React, Vite, Node server APIs, or one package manager from the presence of TypeScript alone.
- Record baseline failures and existing conventions. Never claim a check passed unless it actually ran.

### 2. Choose the smallest suitable profile

- Node ESM: consult `templates/node-esm/tsconfig.json` and confirm the package's ESM/module conventions before adopting it.
- Browser app using React + Vite: consult `templates/browser-react-vite/tsconfig.json`; merge with existing Vite/framework config and dependencies.
- Other framework or an established repository: use `templates/common` as a policy reference and adapt compiler options to the official framework/tooling guidance. Do not paste a mismatched preset.
- If the repository already has equivalent, healthy tooling, preserve and improve it instead of adding duplicate tools.

### 3. Apply guardrails in risk order

Prioritize:
1. Reproducible install and a lockfile consistent with the chosen package manager.
2. Type checking with `strict` and selected safer compiler options.
3. ESLint with recommended type-aware rules for promises, unsafe types, and switch exhaustiveness.
4. Clear `lint`, `format:check`, `typecheck`, `test`, and build commands that really exist.
5. Regression tests and integration/e2e coverage for critical behavior.
6. Import-boundary/circular-dependency checks only after confirming the intended architecture.
7. CI, security, and performance checks that match the project's risk.

Do not adopt every template item just to complete a checklist. For legacy repositories, distinguish pre-existing debt from regressions; make new high-risk violations blocking first, then tighten the baseline deliberately.

### 4. Handle lint and TypeScript suppressions carefully

- Do not fix a type error by reaching for `any`, `@ts-ignore`, `@ts-nocheck`, a broad ESLint disable, or by weakening compiler flags.
- At an external boundary, validate unknown data at runtime (using the project's existing schema approach or a justified schema library) before treating it as a trusted domain type.
- Treat `@ts-expect-error` and lint suppressions as exceptional: require a precise explanation and keep the suppressed scope minimal.
- Start complexity and length thresholds as warnings; review actual violations before making them merge blockers.
- Do not blanket-ban useful comments, long functions, dependencies, or abstractions. Require a clear failure mode for every custom rule.

### 5. Preserve the package-manager and framework choices

- Use the lockfile and package-manager metadata to select commands (npm, pnpm, Yarn, or Bun). Do not generate a second lockfile.
- Add dependencies only when they solve a real gap; explain why and update the one authoritative lockfile.
- Framework-specific configs take precedence over generic examples when the framework has official recommended setup.
- For Vite apps, avoid adding a standalone `vitest.config.ts` that unintentionally overrides Vite configuration. Merge test settings into `vite.config.ts` or use an intentional shared config.
- If adopting `eslint.config.mjs`, verify the current installed versions support ESLint flat config and the `typescript-eslint` package API shown in the template.

### 6. Make verification prove something

Run existing project commands first to establish a baseline. After changes:
- Run formatting check, lint, type check, targeted tests, the full relevant test suite, and build where applicable.
- For bug fixes, show the regression test fails before the fix when practical and passes after the fix.
- Verify behavior using integration/e2e checks or a documented manual flow when unit tests are insufficient.
- For important new lint/architecture rules, prove that a representative forbidden example is rejected and valid code remains accepted. Do this in a temporary fixture or isolated test and remove it afterward.
- Inspect the full diff, `git diff --check`, lockfile churn, suppressed diagnostics, skipped tests, and changes to CI gates.
- Do not turn missing dependencies, unavailable services, or skipped tests into green results.

### 7. Finish with a useful report

Report:
- Which guardrails were introduced or changed and which failure each prevents.
- The exact checks run and pass/fail status.
- Checks not run and why; identify baseline failures separately.
- Important remaining risks and the next few improvements.

Do not claim that the codebase is agent-proof or secure merely because lint and tests pass.

## Reference files

Read only the material relevant to the current task:
- `references/rule-policy.md` for rule priorities and calibration.
- `references/project-profiles.md` to choose a template without mixing incompatible assumptions.
- `references/ci-and-verification.md` for reliable merge gates.
- `templates/` for editable starting points, not files to copy wholesale into every project.
