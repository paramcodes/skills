# Quality rubric for agent-ready repositories

Use this as a decision aid, not as a mandatory shopping list. Rank findings by severity, likelihood, recurrence, detection difficulty, and the cost of a durable fix.

## Decision rule

For each finding, record:

- **Failure mode:** what concretely can go wrong?
- **Evidence:** where was it observed (test failure, configuration gap, repeated review feedback, incident, or known risk)?
- **Durable fix:** architecture, type/schema, test, lint, CI, documentation, or operational policy?
- **Verification:** how will we prove the fix catches or prevents the failure?
- **Cost/false-positive risk:** who maintains the check, and what legitimate code might it reject?

Prefer controls with high signal and low maintenance. If instructions can address a workflow problem, use concise instructions. If correctness must be guaranteed, prefer executable constraints.

## Recommended order

### 1. Reproducibility
- A clean checkout can install dependencies reproducibly.
- Runtime/toolchain versions and dependency lock strategy are explicit.
- Setup, lint, type-check, unit tests, build, and integration checks are discoverable.
- Missing tools or services produce an explicit failure, not a silent skip.

### 2. Correctness
- Compiler/type checker runs in CI.
- Inputs from external boundaries are validated at runtime.
- Async operations and errors are handled according to project conventions.
- Bugs have regression tests that assert observable behavior.
- Tests fail for the intended reason; avoid tests that simply mirror implementation details.

### 3. Architecture
- Module ownership and permitted dependency direction are documented.
- Cross-layer imports and circular dependencies are checked when useful.
- Domain rules have a canonical home.
- Public interfaces are clearer than internal reach-through imports.
- Abstractions are introduced for demonstrated reuse or isolation needs, not speculatively.

### 4. Maintainability
- Complexity and duplication are measured in high-risk areas.
- Names and file organization make code easy to locate.
- Error handling, logging, configuration, and data access use predictable patterns.
- New warnings do not create unbounded baseline noise.
- Suppressions have narrow scope, a reason, and (when appropriate) an owner or removal condition.

### 5. Security and operations
- Secrets are not committed; logs avoid sensitive data.
- Authentication and authorization are tested at trust boundaries.
- Dependency and source security checks are proportionate to the threat model.
- Deployment, data destruction, and credential changes require suitable permissions and approval.
- Critical workflows have observable logs/metrics and rollback strategies where appropriate.

### 6. Behavior and performance
- Critical user journeys have repeatable acceptance or end-to-end checks.
- Mutation testing is used selectively where a missed defect is expensive.
- Performance budgets reflect measured user or system bottlenecks.
- Flaky checks are fixed rather than routinely retried until green.

## Lint policies: calibration, not cargo cult

These are starting points for discussion, not universal limits:

- Function length: flag suspiciously large functions for review; choose limits based on language and existing style.
- File length: flag files that mix many responsibilities; exclude generated files and fixtures.
- Argument count: flag long positional signatures when a cohesive options object would clarify the contract.
- Complexity/nesting: flag dense decision logic when it harms review or testability.
- Duplication: focus first on copied domain behavior, not harmless repeated syntax.

For legacy code, start by preventing new violations or apply thresholds to changed code. Do not force a repository-wide cleanup unrelated to the task. Make every custom rule explain the violation and an actionable path to a fix.

## Common anti-patterns

- Adding many tools without proving they run on a clean checkout.
- Treating line-count, coverage, or lint cleanliness as a complete measure of correctness.
- Blanket bans on comments, dependencies, or all long functions.
- Writing a custom linter when a maintained tool already covers the case.
- Adding huge instruction files instead of fixing architecture or check reliability.
- Automatically applying every suggestion despite the project's stack or risk profile.
- Relaxing a check to make a broken change pass.
- Making CI depend on a developer's uncommitted local state or undocumented secret.
