# Mistake log

This log records mistakes this repository has made and the guardrail that now catches each one. A
row is added only when a guardrail exists. `docs/ratchet.md` describes the three steps that
produce a row.

| Date | Mistake | How it slipped through | Fix | Guardrail now |
| ---- | ------- | ---------------------- | --- | ------------- |
|      |         |                        |     |               |

## Reading a row

The mistake column names what the repository got wrong. The how-it-slipped-through column names the
check that was absent, because an absent check is what let the mistake through. The fix column names
the decision that was recorded. The guardrail column names the artifact that now fails when the
mistake returns.

A mistake that repeats after its guardrail existed is a guardrail failure. Fix it at a stronger
layer than the one that already failed and add a new row.
