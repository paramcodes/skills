# @@PROJECT@@

One paragraph on what this project is and who uses it. Replace this line before the first commit.

## Commands

| Command                   | What it does                                              |
| ------------------------- | --------------------------------------------------------- |
| `@@PM@@ run dev`          | Run the app locally                                       |
| `@@PM@@ run verify`       | Format check, lint, typecheck, unit tests, build          |
| `@@PM@@ run verify:full`  | `verify` plus the integration tests                       |
| `@@PM@@ run test:e2e`     | Drive the app the way a user does                         |
| `@@PM@@ run harness`      | Score the harness criteria                                |
| `@@PM@@ run prove`        | Prove every guardrail catches the mistake it was made for |
| `@@PM@@ run prove-harness`| Prove the harness fails when it is broken                 |

## Rules

Every rule below names the path that enforces it and the kind of that path, as
`Enforced by: <kind>:<path>`. The kinds are `config`, `file`, `command`, and `document`. A path
that exists but enforces nothing fails the entry-point criterion, so a rule that points at a
document instead of a check does not pass.

- Pages, components and domain code never import the data layer directly. Enforced by: config:eslint.arch.mjs
- Every exported data function takes the actor whose rows it reads, or it is listed with a reason. Enforced by: file:scripts/harness-score.mjs
- The source tree has no escape hatches: inline lint config, `@ts-ignore`, `@ts-expect-error` and skipped tests are errors. Enforced by: config:eslint.config.mjs
- Every rule in this file names the path that enforces it and the kind of that path, and this file stays under 100 lines. Enforced by: file:scripts/harness-score.mjs
- Every mistake earns a permanent check, and the check is proved by writing the bad code and showing it fails. Enforced by: file:scripts/prove-guardrails.mjs
- The harness fails when it is broken: a mutated copy of the harness must break the scorer. Enforced by: file:scripts/prove-harness.mjs
- A mistake that returns after its guardrail existed is a guardrail failure, and the fix moves to a stronger layer. Enforced by: document:docs/ratchet.md
- Every mistake is logged with the guardrail that catches it and the proof case that covers it. Enforced by: document:docs/mistake-log.md
- The pre-commit gate runs format, lint and typecheck on the staged files. Enforced by: config:lefthook.yml
- CI runs the same canonical commands and scores the harness. Enforced by: config:.github/workflows/ci.yml
- Work happens on a task branch, never on the default branch. Enforced by: file:scripts/guard-branch.sh
- The canonical commands live in the package manifest: format, lint, typecheck, test and build. Enforced by: config:package.json

## Where things live

Name the directories a reader needs to find a behaviour, and the one line that says which layer
owns each one. Keep this section short and let the paths do the work.
