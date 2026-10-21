# CI contract

A green required check should mean a specific, reproducible thing. Keep the local and CI contracts aligned.

## Three useful tiers

### Fast feedback
Run frequently during implementation:
- formatter check
- lint
- type check / compile
- targeted unit tests
- architecture/import-boundary checks

### Pull-request gate
Run before merge:
- every required fast check
- full unit and relevant integration tests
- build/package verification
- security/dependency checks appropriate to the project
- focused browser/e2e coverage for changed critical behavior
- migration checks where applicable

### Scheduled or risk-based
Run when cost justifies it:
- mutation testing on important domain logic
- broader e2e regression sweeps
- performance benchmarks
- deeper dependency/supply-chain analysis
- long-running, resilience, or memory tests

Small projects may combine tiers. Large projects can use targeted feedback locally and enforce the full required suite in CI.

## Contract checklist

- Commands are defined in the project's native task runner and documented.
- CI calls the same underlying commands as local verification.
- Toolchain and dependencies are pinned or reproducibly resolved.
- Required services are started explicitly and health-checked.
- Setup/tool/test failures are non-zero failures.
- Required checks do not use `|| true`, broad `continue-on-error`, unconditional skips, or swallowed exceptions.
- Test reports and failure artifacts are retained where useful.
- Baseline failures are visible; a changed-code policy does not hide new failures.
- Check names are stable, diagnostics name files/tests/commands, and failure output is actionable.
- Changes to workflows, gate definitions, secrets, deployment, and authorization receive the appropriate review.

## Suggested command contract

Choose names that fit the repository. These labels are conceptual; do not add redundant wrappers if the project already has good equivalents.

- `doctor`: diagnose prerequisites and setup; clearly distinguish warnings from blockers.
- `verify-fast`: formatter, lint, type-check/compile, and focused tests.
- `verify-all`: all required tests, build, and other merge gates.
- `verify-feature <feature>`: exercise one documented feature or test target.

For a Node project, these may be package scripts; for another ecosystem, Make, just, Task, tox/nox, Cargo, or native tooling may be more natural.

## Guardrail verification

When adding a new lint or CI rule, verify at least one of the following:

- a representative valid example passes;
- a temporary or fixture-based invalid example fails for the expected reason;
- a dedicated rule test validates the rule's behavior.

Do not leave invalid production code behind merely to demonstrate the rule. Keep validation fixtures isolated and clean them up.
