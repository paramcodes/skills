---
name: agent-rules
description: "Set up or maintain a repository so that coding agents work in it safely: a machine-checkable rule table, an auditor that fails when a rule stops being true, generated projections, and code owners that stop an agent rewriting the rules. Use for /rules-init, 'set this repo up for agents', 'add AGENTS.md rules', 'protect the agent rules', 'audit the rule table', or any repository where several agents work in parallel."
---

# Agent rules

A repository where several coding agents work in parallel needs its operating rules to be
**checked**, not trusted. This skill sets that up and keeps it honest.

## The one idea

**A rule is only real when a mechanism acts on it. A rule with no artefact cannot be checked, so
it cannot be enforced, so it is a wish.**

Everything below follows from that.

## Why prose is not the answer

The measured position, from the research recorded in
`docs/research/2026-agent-workflow.md` when that file exists.

- Context files do not improve task success on average and cost more than 20% extra inference.
  Developer-written files gained 2.4%, which is not significant. Agents **follow** the
  instructions they are given, so obedience is not the problem and the instruction file is the
  wrong place for the rule.
- 62% of real repositories restate what their linter already enforces. That is lint leakage, and
  it costs inference for nothing.
- Instruction files grow about 4.9 instructions per commit, regrow to 91.5% of their previous size
  within 10 commits of a rewrite, and older instructions are *less* likely to be deleted, because
  each carries latent reasoning that is expensive to recover.

So the answer is not a better-written `AGENTS.md`. It is a rule table plus a check.

## The shape

Five pieces. Each is small and each does one job.

1. **The rule table.** One YAML file per rule, in a directory. A rule names its enforcement layer,
   the path and marker that enforce it, the artefact that proves it, the failure that caused it,
   and its owner.
2. **The auditor.** A deterministic script. It fails when a rule's enforcing path or marker is
   gone, when a rule has no artefact, when a rule has no failure, when two rules contradict, and
   when a protected path has no owner. It never edits anything and never needs a model.
3. **The projector.** Generates the files that are derived from the table, the thin instruction
   file, the code owners file, and the protected-path table. A check mode fails when a projection
   was hand-edited.
4. **The context file.** The repository's orientation facts, as opposed to its constraints. Which
   branch to cut from, which queue file to update, what the merge policy is. A generated
   instruction file that drops these loses ten rules in one edit.
5. **The ownership.** Code owners plus branch protection, so an agent cannot change the rules
   without a human who owns them.

## The enforcement layer

Each rule names one layer. Pick the strongest that works.

| Layer | What it is | Example |
|---|---|---|
| `type` | Types and signatures | A branded id type so the wrong id does not compile |
| `primitive` | A library primitive | One wrapper around the dangerous call |
| `runtime` | A runtime invariant | An error boundary, a boot assertion |
| `test` | A behavioural test | An integration test that runs against a real database |
| `lint` | A lint rule | A rule that bans the structural anti-pattern |
| `ci` | A CI job | A job that fails when the mechanism is removed |
| `prose` | A sentence in the instruction file | Only when enforcement would be unreliable |

A rule with `prose` and no mechanism is unenforced. The auditor counts those, and the count is the
signal. It should go down, not up.

## The marker

The part that makes a rule checkable is the marker, a string that must still appear in the file
that enforces the rule.

```yaml
id: no-blank-app-page
layer: runtime
enforced_by:
  - path: apps/web/app/(app)/error.tsx
    match: 'role="alert"'
artifact:
  - path: apps/web/e2e/app-shell.spec.ts
failure: |
  2026-10-20. The app route group had no error boundary, so a failing query
  rendered Next's generic error page: a near-blank white screen with no app
  chrome and no way back.
owner: "@your-org"
```

A marker must be **specific enough that deleting the mechanism takes the marker with it**. A
marker of `bun run test` survives deleting the job that runs it, because `bun run test:e2e`
contains it. When one marker cannot scope a mechanism to one place, use a list of markers, where
the first anchors a block and the rest must sit inside it.

The `failure` field is not decoration. It is the reason the rule exists, and it is what makes the
rule safe to delete later. A rule without a failure is an unearned preference.

## Setting a repository up

### 1. Detect, do not ask

Read the repository and derive the facts: the linter config, the CI workflow, the test config, the
framework and its version, the lockfile, the package layout, whether a database is configured.

A **catalogue** holds *derivations*, not rules. "If you have a linter, then this rule" produces a
rule only for repositories that have a linter. "If your framework is X at version Y, then this
rule, and here is the command that installs it" produces it only where it applies. A well-configured
repository gets ten rules, a bare one gets two, and both get the right ones.

A catalogue of plain rules is the failure mode. It produces the same fixed set everywhere and most
of them are wrong for most projects.

### 2. Ask only what cannot be detected

Four questions, batched, because a bootstrap that asks forty questions gets abandoned.

- Who owns the rule table, and which team may change it? A handle, which becomes the code owner.
- Which of the detected facts should be rules? A list to accept or reject, each with its evidence.
- What is heavy on this machine, and which commands count as heavy? The core count and the names.
- Is there a rule from this project's history the detector cannot see? Free text.

### 3. Write the machinery, not the rules

The auditor, the projector, the context file, the code owners, the CI job, the scripts. The
instruction file becomes a thin routing file with a generated header, a pointer to the table, the
rule count, and nothing else. It must not restate the rules, because a restatement is a second copy
that drifts.

### 4. Prove the check works

Break a rule on purpose. Show the audit failing. Restore it. Show it passing. A check the human has
never seen fail is a check they will not trust.

### 5. Report honestly

Zero failure-derived rules, because the project has not had any failures yet. That is correct, and
it should be said plainly, with the strikes listed so the human knows what to do next.

## The failure discipline

Most things that break are bugs. Fix them. A rule comes later, and only if the class repeats.

- **Strike one.** It happened. Fix it locally, note it in the commit.
- **Strike two.** The class recurred. Change the shape of the code so it cannot happen again, and
  that is where a rule-table entry earns its place, pointing at the new shape.
- **Strike three.** It is a pattern. Write a lint rule or a hook that forbids it outright, and the
  table entry points at that.

The rule almost never requires new code. By strike two the mechanism already exists, because
changing the shape of the code is what strike two means. The rule writes down a pointer to it.

## When a rule is written

An agent that just did the fix can draft the entry. The human writes the failure story, because
the agent knows the technical symptom and the human knows whether it was a bad deploy, a missing
migration, or a Tuesday.

Keep an incident log. One row per incident, with a class and a strike count. The log is the input
and the table is the output, and the counting is what stops the human having to remember.

## Protecting the rules

The rules file is policy. An agent that can edit it, approve the pull request and merge it, has
not been protected by anything.

- Code owners on the rules file, the table, the workflows, the hooks, the token source, and the
  code owners file itself.
- Branch protection that requires a pull request, an approving review, a code-owner review, and
  approval of the most recent push. A bot cannot approve its own pull request, so this is the
  primitive that actually stops one.
- The code owners file must protect itself, so a pull request cannot remove the reviewer
  requirement and change the rule in the same merge.

One thing no platform setting can do. An agent running with the owner's own credentials is
indistinguishable from the owner. That is a credential problem. Give the agent a token without
write access to the protected paths.

## Two checks that earn their keep

**The oracle.** A test whose expected value came from the same prompt as the code repeats the
code's mistakes. It passes and it proves nothing. Either assert on a value the agent could not
invent, hold the oracle in a file the agent does not own, or verify against the real thing.

**The runtime surface.** A change is not done because a test passed. It is done when the surface
it touched was observed in the running application. A route change means the route was driven in a
real browser. A query change means the query ran against the real database. A configuration change
means the process was started with it and logged its resolved target.

Every DOM assertion passes on a page a human cannot read. Only a screenshot or a bounding box
shows that.

## Where to put the files

```
docs/ai/rules/*.yaml      the table, one file per rule
docs/ai/README.md         the format, the layers, how to add a rule
docs/ai/context.yaml      the orientation facts
docs/ai/protected-paths.md the generated path table
scripts/audit-rules.ts     the auditor
scripts/sync-agent-rules.ts the projector
```

The auditor and the projector are **project-local copies**. The tooling that creates them is a
package, and the package is not a runtime dependency. CI does not change when the package updates,
a compromised package cannot change a build, and a project can fork the scripts and never hear from
the package again.

## The instruction file

Keep it thin. Under a hundred to two hundred and fifty lines, or under five hundred tokens. What
belongs in it: the repository overview, the setup and command lines, the validation ladder, the
definition of done, and a pointer to the table. What does not: the rules themselves.

Scope the file by directory, not by a list of files. A nested file per package, each holding only
its subtree's additions, and the parent wording not repeated.

Two hazards to know. A rules file can be silently truncated by the harness, and a truncated file
produces exactly the symptom of rules that do not hold. And the precedence between instruction
files differs between tools, some replacing and some concatenating, so the root file must be
self-contained.
