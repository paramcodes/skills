# Mistake log

This log records mistakes this repository has made and the guardrail that now catches each one. A
row is added only when a guardrail exists and a proof case covers it. `docs/ratchet.md` describes
the three steps that produce a row.

| Date | Mistake | How it slipped through | Fix | Guardrail now | Proof case |
| ---- | ------- | ---------------------- | --- | ------------- | ---------- |
| 2026-10-21 | The harness scored a count of criteria, so a deleted criterion kept the score green | The scorer compared a length and never held the expected criterion ids | The scorer holds the expected criterion ids in its own code and compares them as an exact set | scripts/harness-score.mjs | the harness fails when a criterion is deleted |

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
