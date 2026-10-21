# Repository Engineering Contract

## Purpose
<!-- Describe the product and its major modules in 2-4 sentences. -->

## Source of truth
- Follow existing, working patterns before adding an abstraction.
- Read `docs/architecture.md` before changing module boundaries, if present.
- Treat types, schemas, tests, lint rules, and CI as executable contracts.
- Keep business rules in their canonical module; do not duplicate them.

## Required workflow
1. Inspect relevant implementation, tests, project instructions, and current Git changes.
2. For non-trivial work, identify intended behavior and important failure cases.
3. Make the smallest coherent change that solves the problem.
4. Add regression coverage for bugs and behavior changes at the appropriate layer.
5. Run the project's documented verification commands.
6. Verify user-visible behavior through the appropriate integration/e2e path when relevant.
7. Report checks actually run, results, and remaining uncertainty.

## Architecture
<!-- Replace with real, enforceable module/dependency rules. Avoid generic rules that do not match this repo. -->
- Follow the dependency directions documented by this project.
- Validate untrusted data at system boundaries.
- Use established APIs for persistence, logging, errors, and authorization.

## Safety
- Never commit secrets or log sensitive data.
- Never disable a failing check or weaken a quality/security rule merely to make a change pass.
- Do not run production operations, publish releases, or perform destructive data changes without explicit authorization.
- Avoid new dependencies unless the need and maintenance cost are justified.

## Definition of done
- Requested behavior is implemented with appropriate tests.
- Relevant type, lint, architecture, test, and build checks pass.
- The relevant feature has been verified at the level appropriate to its risk.
- No unrelated changes, unexplained suppressions, or silently skipped checks remain.
- Completion notes distinguish verified behavior from assumptions and blockers.
