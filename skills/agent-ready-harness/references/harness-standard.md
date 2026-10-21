# Harness standard

Ten criteria. Each one runs a real check against the repository. The scorer exits non-zero when
one fails, and the count is checked so the list cannot silently shrink.

Adapt a criterion when the stack makes it meaningless. Replace it with one that holds. Record the
replacement in the `notes` array of `harness.config.json`. Never delete one.

## 1. Layer boundaries are enforced by a tool

**Proves:** the layers that must not reach across a boundary cannot, and the check runs in the
gate rather than in a reviewer's memory.

**Check:** the boundary command exits zero.

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

**Check:** the proof command exits zero and reports zero missed cases.

**Adapt:** one case per guardrail. A new guardrail ships with its case in the same change.

## 4. Escape hatches are errors

**Proves:** the source tree has no quiet exits. Inline lint config, `@ts-ignore`,
`@ts-expect-error`, skipped tests, and raw JSON parse are all errors in the source tree.

**Check:** the lint configuration names each rule.

**Adapt:** keep the rules that exist in the stack's linter, and add a local rule for the ones it
cannot express. A custom rule needs a documented failure mode and its own proof case.

## 5. The entry-point file is valid

**Proves:** the file an agent reads first is short, and every rule in it points at a file that
exists. A rule with no enforcement path is a wish.

**Check:** the entry-point test runs and passes. It asserts the file stays under its line limit,
that every rule names an enforcement path, that each path exists on disk, and that the
second entry point points at the first.

**Adapt:** the limit is the `maxLines` value in the config. The test is a Vitest file, and it moves
to the repo's test runner when the repo uses another one.

## 6. The local gate exists

**Proves:** a broken change fails before it reaches the branch.

**Check:** the hook file names the pre-commit stage and the format, lint, and typecheck commands,
and the commands run against staged files.

**Adapt:** use the repo's hook runner. Keep the same three checks.

## 7. CI runs the harness

**Proves:** the merge gate is the same thing the local gate is, plus the harness score. CI that
runs different commands proves nothing about the local loop.

**Check:** the workflow file exists and runs the harness command.

**Adapt:** keep the canonical commands identical to the local ones. Split quick and full jobs
when the full one is slow, and let the full one own the harness score.

## 8. The ratchet document is real

**Proves:** the procedure that turns a mistake into a permanent check is written down, and it names
the three steps.

**Check:** the document exists and names the strongest layer, the proof case, and the log row.

**Adapt:** keep the three steps. The layers listed inside them change with the stack.

## 9. The mistake log has its schema

**Proves:** mistakes are recorded in a shape a reader can scan, and every row names the guardrail
that now catches it.

**Check:** the log exists and carries the documented columns.

**Adapt:** copy the schema. The row count grows as the repo makes mistakes, and a row without a
guardrail behind it is a hope rather than a rule.

## 10. The full verify gate passes

**Proves:** the repository is green on the commands a contributor runs.

**Check:** the verify command exits zero.

**Adapt:** the verify command is the repo's own. It must include the format check, the lint, the
typecheck, the unit tests, and the build.

## Adding a criterion

A criterion earns its place when it protects a rule that a real mistake broke. Add it with the
proof case in the same change, and raise `minimumCriteria` in the config so the count stays honest.
