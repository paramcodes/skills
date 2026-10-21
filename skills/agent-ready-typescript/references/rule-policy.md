# TypeScript rule policy

This policy is designed to reduce real defects without turning lint into a source of noise. Every rule should have a known failure mode, actionable output, and a clear owner.

## Blocking by default

- TypeScript strict mode and the selected extra safety flags.
- ESLint's `recommended` plus `typescript-eslint` `recommended-type-checked` and `stylistic-type-checked` presets where compatible.
- `@typescript-eslint/no-explicit-any` for application code; prefer precise types or `unknown` at genuinely unknown boundaries.
- `@typescript-eslint/no-floating-promises` to surface unhandled promises.
- `@typescript-eslint/no-misused-promises` to catch promises used in unsafe contexts.
- `@typescript-eslint/consistent-type-imports` for explicit type-only imports.
- `@typescript-eslint/switch-exhaustiveness-check` for closed unions/enums when exhaustive handling matters.

These are defaults to evaluate, not an instruction to override an existing framework's official config. Type-aware rules require ESLint to find the correct TSConfig for all linted TypeScript files.

## Warn first; calibrate before blocking

The template warns on complexity above 12, nesting depth above 4, and more than 4 parameters. These are maintainability signals, not evidence of a bug by themselves. Review generated code, parsers, schemas, framework glue, and legitimate algorithms before raising a threshold or adding an exception.

When the repository has many existing violations, avoid making every old file block new work. Prefer a visible baseline, a changed-code policy where available, or gradual cleanup of high-risk areas. Never suppress all results or silently skip the rule.

## TypeScript compiler options

The base preset enables `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `verbatimModuleSyntax`, and unused local/parameter checks. These options can reveal real issues in older code. Apply them to new projects directly; for mature projects, introduce them deliberately and fix errors rather than silencing the compiler wholesale.

Compiler options differ by runtime. Node ESM and browser/bundler apps must not share a single module-resolution config by accident. Frameworks may supply project-specific recommended TSConfigs; merge these safety options where compatible.

## Suppression policy

- No `@ts-nocheck` as a repair strategy.
- Avoid `@ts-ignore`; when suppression is truly required, prefer narrowly scoped `@ts-expect-error` with an explanation and a test where appropriate.
- Do not leave unexplained ESLint disables, `any`, broad casts, skipped tests, or weakened CI rules to make the build green.
- Validate runtime data from APIs, databases, files, environment variables, and browser storage. TypeScript annotations alone do not validate data.

## Architecture rules

Choose one dependency-boundary tool only if the project has real layers or feature boundaries. First document allowed dependencies, then add a rule and a fixture proving that a forbidden import is rejected. Do not enforce arbitrary `src/feature-a` path assumptions on a repository with a different layout.

## Add a rule only when

1. A concrete recurring defect or maintainability issue exists.
2. The rule detects it reliably with acceptable false positives.
3. Its failure tells an agent how to resolve the violation.
4. The rule is tested with both valid and invalid examples when practical.
5. Exceptions are narrow, documented, and reviewable.
