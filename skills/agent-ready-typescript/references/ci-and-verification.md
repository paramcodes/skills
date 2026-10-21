# CI and verification contract for TypeScript

## Local contract

Expose a small set of commands that exist and work:

- `lint`: ESLint, including type-aware rules where configured.
- `format:check`: formatter in check mode, not write mode.
- `typecheck`: TypeScript compiler with the intended project config.
- `test`: focused/unit or integration suite appropriate to the project.
- `build`: real production build.
- `verify:fast`: a stable composition of required local checks, with failures propagated.

Keep package-manager commands consistent with the project's lockfile. Avoid generating multiple lockfiles. Never make the required CI workflow skip a missing command or use `|| true` for required checks.

## CI layers

- Fast local feedback: formatting check, lint, typecheck, focused tests.
- Pull-request merge gate: the full required fast suite plus build, integration tests, and security/dependency checks as appropriate.
- Scheduled or risk-based: mutation testing, deeper end-to-end tests, broader dependency audits, and performance measurements.

Do not add an arbitrary test-coverage percentage just to get a badge. Prefer useful assertions for critical behavior, regression tests, and mutation-testing samples when the consequence justifies the cost.

## CI hardening

- Run on a clean checkout and install from the committed lockfile.
- Use explicit runtime versions and least-privilege workflow permissions.
- Set timeouts and preserve useful failure artifacts.
- Required steps should fail clearly when tools, tests, or build artifacts are missing.
- Protect workflow files, lint/type configuration, release logic, and security policy with review/branch rules.
- Pin third-party actions to full commit SHAs for higher supply-chain assurance, and update them deliberately.
- Treat CI config changes as high leverage: verify that the checks still run, and that a known invalid change remains rejected.

## Behavioral verification

A green compile means the project compiles; it does not mean users can complete a workflow. Use integration tests, browser automation, or a documented manual protocol for important user paths. Follow Playwright's guidance to test user-visible behavior and isolate test state. Save traces/screenshots/logs when they materially aid diagnosis.
