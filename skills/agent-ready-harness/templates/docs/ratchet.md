# Ratchet

A ratchet turns a mistake into a check that fails without a human noticing. Each mistake this
repository has made earns one guardrail, and each guardrail tightens the next change.

The procedure has three steps. Do them in order.

## Fix at the strongest layer

Choose the strongest layer that can hold the rule, and do not stop at a weaker one.

1. A type or schema that makes the mistake unrepresentable. A required argument, a branded type, or
   a constraint the compiler or the database refuses to compile past.
2. A lint rule or an architecture boundary. A rule whose message names the fix fails the build
   before a reviewer reads the diff.
3. A test that asserts the behaviour a user observes.
4. Documentation in `AGENTS.md` or the architecture decision records.

Fall back to documentation only when no stronger layer applies. A sentence in a file is read
sometimes and obeyed never, so it is the last layer and not the first. Record the choice in the
decision records when the layer is not obvious, or when a stronger layer was rejected for a reason
a reader would otherwise have to guess.

## Add a proof case

Every fix needs a case that fails before the fix and passes after it, and a reviewer must be able to
rerun it.

- A lint or architecture guardrail gets a case in the `proofs` array of `harness.config.json`. The
  case writes a file that breaks the rule, runs the checker that owns the rule, and asserts the
  checker failed.
- A lint rule gets a second case as well: a legitimate construct the rule must not flag. A rule
  that flags everything blocks the next session, and a rule without that case cannot be shown to
  leave good code alone.
- A behavioural fix gets a test.

A fix with no proof case is not done. The case is the artifact a reviewer runs, and a guardrail
without one cannot be shown to catch the mistake it was made for.

A proof case is content-pinned. The scorer holds a digest of every case, the hash of what the case
writes, what it expects, and the criterion it breaks, so a case whose content changed without its
digest changing fails the run. Editing a case to make it pass is not a fix, because the edited
case proves nothing. Changing a case means moving its digest in the scorer in the same change, the
way the name of a case is moved in the scorer and in the prover.

## Add a log row

The new case becomes a row in `docs/mistake-log.md`, with the date, the mistake, the check that was
missing, the fix, the guardrail that now catches it, and the proof case that covers it.

The proof case column names the case that shows the guardrail bites. It is the name of a case in
the `proofs` array of `harness.config.json`, or the name of a mutation in
`scripts/prove-harness.mjs` when the mistake was in the harness itself. A row without that name
records a hope rather than a rule.

The log grows only when a guardrail was added. A row with no guardrail behind it records a hope
rather than a rule. When a mistake repeats after its guardrail already existed, that is a guardrail
failure, not a new mistake. Fix it at a stronger layer than the one that failed, replace the
guardrail, and add a new row.

## When the scope cannot hold the guardrail

Some changes cannot carry the guardrail they deserve. A guardrail that needs a new tool, a new
directory, or a change outside the task's files does not fit the task's scope. The fix then is not
to ship the change without the guardrail. The fix is:

1. Land the strongest guardrail the task's scope can hold.
2. Write the pending guardrail down, with the reason the scope could not hold it and who owns it.
3. Hand the pending guardrail to the coordinator, who records it.

A pending guardrail is a visible debt, not a silent gap. The change is not done until the pending
guardrail lands and its proof case proves it bites.

## Operating rules

Some rules in `AGENTS.md` are enforced by behaviour rather than by a tool, for example plan before
code and one branch per task. Write those down in the same file and keep the reason next to them,
because the reason is what a reader needs when the rule looks arbitrary.

## A ratchet only tightens

A guardrail may not be removed or weakened to make a change pass. If a guardrail is wrong, add a
stronger one beside it, keep both until the stronger one covers the case, then remove the weaker.
Loosening a check to unblock a diff undoes every mistake the check was added for.
