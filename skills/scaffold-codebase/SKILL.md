
# Bootstrap an Agent-Ready Project

You are setting up a new software project that will be developed with AI coding agents. Your goal is to make the repository easy to navigate, safe to modify, straightforward to test, and reproducible on a clean checkout—without overengineering it.

## 1. Understand before scaffolding

Establish the product's core user workflows, acceptance criteria, non-goals, risk areas, and intended deployment environment. Select a suitable stack based on the actual requirements. Do not introduce technologies or infrastructure merely because they are popular.

Inspect existing files before writing anything. Preserve any existing work and conventions that remain sound.

## 2. Design the codebase

Identify the primary responsibilities and module boundaries. Define clear contracts and dependency direction. Keep related behavior together; avoid speculative abstractions, unnecessary layers, and generic utility dumping grounds.

Use strict types where the language supports them. Validate untrusted inputs at runtime boundaries. Document only architecture decisions that would otherwise be difficult to rediscover.

## 3. Configure the engineering baseline

Choose one primary formatter, an appropriate linter, the compiler or type checker, and the project's test runner. Use the ecosystem's conventional tools and pin compatible dependencies.

Expose canonical commands for formatting checks, lint, type checking, unit tests, build, and slower integration or end-to-end tests where applicable.

Do not duplicate tools or commands unless each adds distinct value.

## 4. Test meaningful behavior

Start testing with the first vertical feature slice. Prioritize business logic, external boundaries, authorization, persistence, failure paths, and critical user workflows.

Prefer behavior-oriented tests over tests coupled to implementation details. Keep tests deterministic and isolated. For behavior-changing features and bug fixes, use test-first development when it is practical and the expected behavior can be expressed clearly.

Add a regression test when a bug is discovered. Do not add tests merely to increase a test count.

## 5. Add Git hooks and CI

Choose one Git-hook manager, if useful. Run fast formatting, lint, and appropriate staged-file checks locally. Do not put an expensive full end-to-end suite on every commit by default.

Set up CI for pull requests. Use reproducible dependency installation, enforce the canonical verification commands, preserve actionable failure output, and split independent expensive checks when that reduces feedback time.

Use minimal CI permissions, safe secret handling, and appropriate branch protection. Do not imply a check is enforced merely because a document mentions it.

## 6. Make the repository discoverable

Write a concise README and root AGENTS.md. Document setup, the relevant module map, canonical commands, the verification ladder, and the definition of done.

Add an architecture document, decision records, or nested instructions only when they provide information that cannot be found reliably from the code, configuration, or existing documentation.

Avoid duplicating lint rules and other mechanically enforced constraints in prose.

## 7. Add project-specific verification

Make at least one critical workflow reproducible from a clean environment. Use the application's actual interface—HTTP, CLI, browser, desktop harness, or another appropriate surface—and capture meaningful evidence.

Formal verification and harness-specific proof infrastructure are optional. Add them only when a specific correctness invariant or custom guardrail justifies their maintenance cost.

## 8. Validate the result

Run the commands that were actually configured. Confirm the app can start or build and that the critical workflow works. Check that CI runs the intended commands and does not swallow failures. Review the full diff for unrelated changes, unnecessary dependencies, excessive rules, or duplicate checks.

Do not claim that anything passed unless it was actually run. Report unavailable checks, known limitations, and the highest-value remaining tasks.

## Definition of done

Another agent should be able to find the relevant code, understand its contract, make a bounded change, run the smallest meaningful verification loop, and know whether the change is safe to ship—without needing private context from the previous session.

