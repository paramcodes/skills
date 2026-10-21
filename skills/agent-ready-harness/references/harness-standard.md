# Harness standard

Thirteen criteria. Each one runs a real check against the repository, and the scorer exits non-zero
when one fails.

The criterion set is an exact set, not a count. The scorer holds the expected criterion ids in its
own code and compares them as a set, so a missing id, a renamed id, and a duplicated id all fail.
Deleting one criterion and duplicating another does not keep the set whole.

The cost ceiling is `maxHarnessSeconds` in `harness.config.json`. The scorer prints its own
runtime and fails when it runs past the ceiling. A criterion that costs more than the ceiling is a
criterion that does not get run.

Adapt a criterion when the stack makes it meaningless. Replace it with one that holds, keep the id,
and record the replacement in the `notes` array of `harness.config.json`. Never delete one.

## The set

| Id                | Check             | What it proves                                                                             |
| ----------------- | ----------------- | ------------------------------------------------------------------------------------------ |
| `boundaries`      | `command`         | The layers that must not reach across a boundary cannot.                                     |
| `data-access`     | `actorParams`     | Every function that touches a user's rows takes the actor whose rows it touches.            |
| `proofs`          | `command`         | Every guardrail catches the mistake it was made for.                                         |
| `escape-hatches`  | `lintRules`       | The source tree has no quiet exits.                                                          |
| `entry-point`     | `entryPointKinds` | Every rule names an enforcement path of a known kind, and that path enforces something.      |
| `local-gate`      | `yamlSteps`       | A broken change fails before it reaches the branch.                                          |
| `ci`              | `yamlSteps`       | The merge gate runs the canonical commands and scores the harness.                           |
| `ratchet`         | `documentSections`| The procedure that turns a mistake into a permanent check is written down.                    |
| `mistake-log`     | `logRows`         | Every mistake names the guardrail that catches it and the proof case that covers it.          |
| `verify`          | `command`         | The repository is green on the commands a contributor runs.                                   |
| `behavioral`      | `behavioral`      | The app works when something drives it.                                                      |
| `artifact`        | `artifactContains`| The build output contains what the sources imply.                                            |
| `second-toolchain`| `command`         | The second language toolchain is gated too.                                                  |

The check names are fixed. The scorer refuses a criterion whose check type it does not know, so a
typo in the config fails instead of passing quietly.

## 1. Layer boundaries are enforced by a tool

**Proves:** the layers that must not reach across a boundary cannot, and the check runs in the
gate rather than in a reviewer's memory.

**Check:** the `command` check runs the boundary command and fails when it exits non-zero.

**Adapt:** name the layers that exist. A repo with `src/domain` and `src/db` bans the data layer
from the domain, the components, and the pages. A frontend with no server layer bans nothing and
replaces this criterion with the boundary it really has, for example a rule that components do not
import from the data-fetching layer.

## 2. The data-access rule is enforced by a tool

**Proves:** every function that reads or writes a user's rows takes the actor whose rows it
touches, so a caller holding an id cannot reach another user's data.

**Check:** the built-in `actorParams` check scans the data layer's exported functions, and fails
when a function takes no actor parameter and is not on the allowlist. The allowlist holds one
line per exception, and every line carries a reason. A stale allowlist entry fails too.

**Adapt:** set the directory, the actor parameter pattern, and the allowlist path. Repos without
a per-user data layer replace this criterion with the equivalent for their own boundary, for
example a rule that every request handler takes the authenticated subject.

## 3. Every guardrail is proved to bite

**Proves:** the checks are not theater. Each proof writes a file that breaks one rule, runs the
checker that owns it, and asserts the checker failed with the expected message.

**Check:** the `command` check runs the proof command, and the prover holds a floor. The floor is
`minimumProofs` in the config, it equals the number of proof cases, and an empty proof set fails.
The prover holds the expected proof names in its own code, so a missing, a renamed, and a
duplicated proof all fail.

**Adapt:** one case per guardrail. A new guardrail ships with its case in the same change.

## 4. Escape hatches are errors

**Proves:** the source tree has no quiet exits. Inline lint config, `@ts-ignore`,
`@ts-expect-error`, skipped tests, and raw JSON parse are all errors in the source tree.

**Check:** the `lintRules` check runs the repository's own linter against an injected probe file
that breaks each named rule, and asserts the linter failed with that rule. The rule names live in
the linter, not in a comment, so a rule that is commented out fails the check.

**Adapt:** keep the rules that exist in the stack's linter, and add a local rule for the ones it
cannot express. A custom rule needs a documented failure mode, a negative case, and its own proof
case.

## 5. The entry-point file is valid

**Proves:** the file an agent reads first is short, and every rule in it points at a file that
enforces something. A rule with no enforcement path is a wish, and a path that exists but
enforces nothing is a wish with a filename.

**Check:** the `entryPointKinds` check reads the entry point, and for every rule it reads the
enforcement path and the kind the rule states. The kinds are `config`, `file`, `command`, and
`document`. A `config` kind is validated by reading the named value. A `file` kind is validated by
the file's shape. A `command` kind is validated by running it. A `document` kind is validated by
the document's sections. Path existence alone is never enough, so a rule that points at two
architecture documents fails.

**Adapt:** the limit is the `maxLines` value in the config. Every rule ends with
`Enforced by: <kind>:<path>`, where the kind is one of the four above and the path is the file
that enforces the rule. A rule enforced by a script that refuses the default branch is a `file`
kind, because the script cannot exit zero on the default branch.

The default entry point states these kinds:

| Path                            | Kind      |
| ------------------------------- | --------- |
| `eslint.arch.mjs`               | `config`  |
| `eslint.config.mjs`             | `config`  |
| `lefthook.yml`                  | `config`  |
| `.github/workflows/ci.yml`      | `config`  |
| `package.json`                  | `config`  |
| `scripts/harness-score.mjs`     | `file`    |
| `scripts/prove-guardrails.mjs`  | `file`    |
| `scripts/prove-harness.mjs`     | `file`    |
| `scripts/guard-branch.sh`       | `file`    |
| `docs/ratchet.md`               | `document`|
| `docs/mistake-log.md`           | `document`|

## 6. The local gate exists

**Proves:** a broken change fails before it reaches the branch.

**Check:** the `yamlSteps` check parses the hook file and looks for the commands the gate must
run. A command counts when a step's `run` value starts with it, or when it stands alone as a line
in a multi-line `run` block. A step that is commented out, a step with `if: false`, and a run
value with `|| true` after the command all fail, because none of them run the command.

**Adapt:** use the repo's hook runner. Keep the same three checks: format, lint, and typecheck on
the staged files.

## 7. CI runs the harness

**Proves:** the merge gate is the same thing the local gate is, plus the harness score. CI that
runs different commands proves nothing about the local loop.

**Check:** the `yamlSteps` check parses the workflow file and looks for the canonical commands, the
harness score, and the self proof. The prover runs once, because the `proofs` criterion runs it
inside the score. A workflow that runs the prover as its own step runs it twice.

**Adapt:** keep the canonical commands identical to the local ones. Split quick and full jobs
when the full one is slow, and let the full one own the harness score.

## 8. The ratchet document is real

**Proves:** the procedure that turns a mistake into a permanent check is written down, and it names
the three steps.

**Check:** the `documentSections` check parses the document and requires the named sections to
exist as headings or as bolded section titles. The words appearing somewhere in the prose do not
count. The three sections are `Fix at the strongest layer`, `Add a proof case`, and `Add a log
row`.

**Adapt:** keep the three steps. The layers listed inside them change with the stack.

## 9. The mistake log has its schema

**Proves:** mistakes are recorded in a shape a reader can scan, and every row names the guardrail
that now catches it and the proof case that covers it.

**Check:** the `logRows` check parses the table, requires at least one row, and requires each row
to name a guardrail path that exists on disk. A log with a header and no row fails. The columns
are the date, the mistake, the check that was missing, the fix, the guardrail, and the proof case
that covers it.

**Adapt:** copy the schema. The row count grows as the repo makes mistakes, and a row without a
guardrail behind it is a hope rather than a rule.

## 10. The full verify gate passes

**Proves:** the repository is green on the commands a contributor runs.

**Check:** the `command` check runs the verify command and fails when it exits non-zero. A no-op
run fails as well, because a command that proves nothing is not a check.

**Adapt:** the verify command is the repo's own. It must include the format check, the lint, the
typecheck, the unit tests, and the build.

## 11. Something drives the app

**Proves:** the app works when something drives it. Every other criterion checks structure, and a
repository whose structure is perfect and whose app does not start is still broken.

**Check:** the `behavioral` check runs the repository's end-to-end command and fails when it
fails.

**Adapt:** name the end-to-end command. A repository with no end-to-end suite replaces this
criterion with the strongest behavioural command it has, and records the replacement in `notes`.

## 12. The build contains what the source implies

**Proves:** the build ships what the source says. A utility class in a shared package with no
rule in the bundle is a class that renders unstyled, and no structural check sees it.

**Check:** the `artifactContains` check names the artifact path, the build command that produces
it, and the strings that must appear in it. The strings are the ones that only appear when the
build really included the source.

**Adapt:** name an artifact a contributor can find, and strings that come from the source rather
than from the build tool itself.

## 13. The second toolchain is gated too

**Proves:** a repository with two languages holds both of them to a gate. The JavaScript gate does
not lint the Python.

**Check:** the `command` check runs the second toolchain's own gate, for example the linter or the
type checker of that language.

**Adapt:** a repository with one toolchain keeps the id and replaces the check with one that holds
for it, for example the repository's own lint command, and records the replacement in `notes`.

## A lint rule needs a negative case

A rule that flags everything is a rule that blocks the next session, and a rule that flags
legitimate code gets deleted the first time it gets in the way. Every lint rule ships with two
cases: one that breaks the rule and must fail, and one that holds a legitimate construct the rule
must not flag and must pass. The negative case is part of the proof set, and the proof set has a
floor, so a rule cannot ship with only the case that proves it fires.

## When the scope cannot hold the guardrail

Some changes cannot carry the guardrail they deserve. A guardrail that needs a new tool, a new
directory, or a change outside the task's files does not fit the task's scope.

The rule then is not "ship the change without the guardrail". The rule is:

1. Fix at the strongest layer the task's scope can hold, and land that.
2. Write the pending guardrail down, with the reason the scope could not hold it and who owns it.
3. The coordinator records the pending guardrail, and the task is not done until it lands.

A pending guardrail is a visible debt, not a silent gap. A change that leaves a guardrail out of
its scope without a row loses the ratchet.

## Adding a criterion

A criterion earns its place when it protects a rule that a real mistake broke. Add it with the
proof case in the same change, raise `minimumCriteria` in the config so the count stays honest,
and add the id to the expected set the scorer holds in its own code. The set grows, and the
standard keeps up with it.
