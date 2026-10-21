# Mistake log

This log records the mistakes this repository has made and the guardrail that now catches each one. A
row is added only when a guardrail exists and a proof case covers it. `docs/ratchet.md` describes
the three steps that produce a row.

A fresh install starts with no rows. The log holds the history of this repository and not the
history of the template it came from, so a row appears only when this repository has made a
mistake and earned a guardrail for it.

| Date | Mistake | How it slipped through | Fix | Guardrail now | Proof case |
| ---- | ------- | ---------------------- | --- | ------------- | ---------- |

<!-- One row, as an example. It is a comment, so the log parser does not read it as a row: | 2026-01-31 | The gate ran the wrong command | The hook echoed the command instead of running it | The hook runs the command | scripts/guard-branch.sh | the branch guard bites | -->

## Reading a row

The mistake column names what the repository got wrong. The how-it-slipped-through column names the
check that was absent, because an absent check is what let the mistake through. The fix column names
the decision that was recorded. The guardrail column names the artifact that now fails when the
mistake returns, and it is a path that exists in this repository. The proof case column names the
proof that shows the guardrail bites: a case in the `proofs` array of `harness.config.json`, or a
mutation in `scripts/prove-harness.mjs` for a defect in the harness itself.

A mistake that repeats after its guardrail existed is a guardrail failure. Fix it at a stronger
layer than the one that already failed and add a new row.

## Pending guardrails

A fix whose scope cannot hold the guardrail leaves a pending guardrail here. The row names the
guardrail, the reason the scope could not hold it, and who owns it. A pending row is a visible
debt and not a silent gap, and it is not closed until the guardrail lands and its proof case
proves that it bites.
