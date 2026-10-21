# TypeScript project contract (merge into the root AGENTS.md)

## Type and boundary safety
- Treat compiler and lint configuration as part of the correctness contract; do not weaken them to make a change pass.
- Do not introduce `any`, `@ts-nocheck`, broad casts, or unexplained suppressions as a shortcut. Use precise types and validate unknown external data at runtime.
- Handle promises deliberately; do not fire-and-forget async work unless the project's documented pattern explicitly calls for it.
- Handle closed unions/enums exhaustively when all variants must be considered.
- Reuse canonical schemas, domain functions, API clients, and error handling instead of reimplementing them.

## Change and verification workflow
- Inspect relevant code and tests before changing architecture or adding an abstraction.
- Add a regression test for a bug fix and test failure cases as well as success paths.
- Use the project's actual package manager and scripts; never generate a second lockfile.
- Run formatting check, lint, typecheck, relevant tests, and the build as appropriate. Report checks that were not run.
- Do not disable a failing test, remove CI checks, or downgrade an error to a warning just to get green verification.
- Keep changes scoped, inspect the final diff, and document any remaining uncertainty.

## Runtime-specific guidance
- Distinguish Node and browser APIs and use the TSConfig that matches the actual runtime.
- TypeScript types do not validate runtime payloads from APIs, storage, environment variables, files, or network messages.
- Do not assume tests prove user-visible behavior; use integration/e2e verification for important workflows.
