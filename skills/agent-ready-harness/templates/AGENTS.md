# @@PROJECT@@

One paragraph on what this project is and who uses it. Replace this line before the first commit.

## Commands

| Command                | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `@@PM@@ dev`           | Run the app locally                                       |
| `@@PM@@ verify`        | Format check, lint, typecheck, unit tests, build          |
| `@@PM@@ verify:full`   | `verify` plus the integration tests                       |
| `@@PM@@ test:e2e`      | Drive the app the way a user does                         |
| `@@PM@@ harness`       | Score the harness criteria                                |
| `@@PM@@ prove`         | Prove every guardrail catches the mistake it was made for |
| `@@PM@@ prove-harness` | Prove the harness fails when it is broken                 |

## Rules

Every rule below names the path that enforces it and the kind of that path. The kinds are `config`,
`file`, `command`, and `document`. A path that exists but enforces nothing fails the entry-point
criterion, so a rule that points at a document instead of a check does not pass.

- Pages, components and domain code never import the data layer directly. Enforced by: eslint.arch.mjs (config)
- Every exported data function takes the actor whose rows it reads, or it is listed with a reason. Enforced by: scripts/harness-score.mjs (file)
- The source tree has no escape hatches: inline lint config, `@ts-ignore`, `@ts-expect-error` and skipped tests are errors. Enforced by: eslint.config.mjs (config)
- Every rule in this file names the path that enforces it and the kind of that path, and this file stays under 100 lines. Enforced by: scripts/harness-score.mjs (file)
- Every mistake earns a permanent check, and the check is proved by writing the bad code and showing it fails. Enforced by: scripts/prove-guardrails.mjs (file)
- The harness fails when it is broken: a mutated copy of the harness must break the scorer. Enforced by: scripts/prove-harness.mjs (file)
- A mistake that returns after its guardrail existed is a guardrail failure, and the fix moves to a stronger layer. Enforced by: docs/ratchet.md (document)
- Every mistake is logged with the guardrail that catches it and the proof case that covers it. Enforced by: docs/mistake-log.md (document)
- The pre-commit gate runs format, lint and typecheck on the staged files. Enforced by: lefthook.yml (config)
- CI runs the same canonical commands and scores the harness. Enforced by: .github/workflows/ci.yml (config)
- Work happens on a task branch, never on the default branch. Enforced by: scripts/guard-branch.sh (file)
- The canonical commands live in the package manifest: format, lint, typecheck, test and build. Enforced by: package.json (config)

## Where things live

Name the directories a reader needs to find a behaviour, and the one line that says which layer
owns each one. Keep this section short and let the paths do the work.
