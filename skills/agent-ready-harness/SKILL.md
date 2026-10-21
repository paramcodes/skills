---
name: agent-ready-harness
description: Install and maintain the agent harness that makes a repository self-verifying a scored criteria list, guardrail proofs that write bad code and prove the checker catches it, a ratchet that turns every mistake into a permanent check, and an AGENTS.md whose rules name the path that enforces them. Use for "install the agent harness", "score my repo", "prove the guardrails", "add the harness", "make this repo agent-verifiable", or when reproducing this setup in a new project.
license: MIT
metadata:
  version: "1.0.0"
---

# Agent-ready harness

Goal: a repository that proves its own agent-readiness. Every rule in `AGENTS.md` names the file
that fails when the rule breaks, one command scores the whole set, and one command proves each
guardrail still bites.

This is the mechanical layer. `agent-ready-project` holds the doctrine, `agent-ready-codebase`
holds the audit workflow, and `agent-rules` holds the machine-checkable rule table for repos where
several agents write in parallel. This skill is the files, the scorer, the proofs, and the ratchet.

## When to use

- A new project, after the stack exists and before the first feature ships.
- An existing repo whose rules are prose only, or whose rule broke twice.
- A new repo that should carry the same harness as an existing one.

## What gets installed

| File                                     | What it proves                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `harness.config.json`                    | The criteria, the layers, the data-access rule, and the proof cases. One source of truth.                                                      |
| `scripts/harness-score.mjs`              | Every criterion runs a real check. Exits non-zero when one fails. It also checks the entry-point file, so every rule names a path that exists. |
| `scripts/prove-guardrails.mjs`           | Each guardrail catches the mistake it was made for. Writes the bad code, runs the checker, asserts it failed, restores the tree.               |
| `eslint.arch.mjs`                        | Layers do not reach across their boundary. Reads the layer list from `harness.config.json`.                                                    |
| `eslint-rules/index.mjs`                 | The escape hatches are errors: inline lint config, `@ts-expect-error`, skipped tests, raw JSON parse.                                          |
| `docs/ratchet.md`, `docs/mistake-log.md` | Every mistake earns a guardrail, a proof case, and a log row.                                                                                  |
| `lefthook.yml`                           | The local gate runs format, lint, and typecheck on staged files.                                                                               |
| `.github/workflows/ci.yml`               | CI runs the same canonical commands, plus the harness.                                                                                         |
| `scripts/guard-branch.sh`                | Work never lands on the default branch.                                                                                                        |

## Install

1. Run the installer from this skill directory:
   `bash scripts/install-harness.sh <repo-path>`
   The installer detects the package manager, copies the files that fit the stack, patches
   `package.json` with the `harness` and `prove` scripts, and prints the adaptation checklist.
   It never overwrites a file that already exists.
2. Adapt `harness.config.json`. Set the layer paths, the data layer directory, the actor
   parameter pattern, and the allowlist file. Every criterion that does not apply to the stack
   gets replaced by one that does, never removed. Record each replacement in the `notes` array.
3. Write the rules in `AGENTS.md`. One bullet per rule, and each bullet ends with
   `Enforced by: <path>`. The path must exist, or the entry-point criterion fails.
4. Run `<pm> harness` and `<pm> prove`. Both must pass before the first commit.
5. Run `<pm> verify` and the project's own test suite.

## The criteria

The standard is ten criteria, and the count is checked. Read
[references/harness-standard.md](references/harness-standard.md) for each criterion, what it
proves, and how to adapt it to a stack that differs.

The default set: layer boundaries enforced, the data-access rule enforced, every guardrail proved
to bite, escape hatches are errors, the entry-point file is valid, the local gate exists, CI runs
the harness, the ratchet document is real, the mistake log has its schema, and the full verify
gate passes.

## The proof loop

A guardrail nobody saw fail is a guess. For each rule:

1. Write a file that breaks it.
2. Run the checker that owns it.
3. Assert the checker failed with the expected message.
4. Restore the tree.

`scripts/prove-guardrails.mjs` does this from the `proofs` array in `harness.config.json`, so the
proof case ships with the rule instead of living in someone's head. Add a case to that array with
every new guardrail.

## The ratchet

Read [references/ratchet.md](references/ratchet.md). The procedure is three steps: fix at the
strongest layer that holds the rule, add a proof case, add a log row. A fix with no proof case is
not done. A guardrail is never weakened to make a change pass.

## Honesty rules

- A criterion runs a real check. A criterion that greps for a string a script prints on success
  is theater, and it must not ship.
- The harness never shrinks. Replacing a criterion is allowed, removing one is not, and
  `harness.config.json` records the reason.
- The scorer prints the reason for every failure and exits non-zero. Never wrap it in `|| true`.
- `minimumCriteria` in the config is a floor. Lower it only when the repo has a written reason.
- The mistake log grows only when a guardrail was added. A row with no guardrail behind it
  records a hope.

## Validate

Before calling the harness done:

1. `<pm> harness` exits zero and prints ten passing criteria.
2. `<pm> prove` reports zero missed cases.
3. Break one criterion by hand, confirm the scorer fails, then restore it.
4. Break one guardrail by hand, confirm the prover catches it, then restore it.
5. Check that the `AGENTS.md` rules and the `harness.config.json` criteria agree. A rule with no
   criterion, or a criterion with no rule, is drift.

## First prompt to give a fresh agent

> Install the agent harness in this repository using the `agent-ready-harness` skill. Run the
> installer first. Then adapt `harness.config.json` to this stack, keeping all ten criteria and
> replacing any that do not apply with ones that do. Write the `AGENTS.md` rules so every bullet
> ends with `Enforced by:` and a path that exists. Run the harness and the proofs, and show that a
> deliberately broken guardrail fails before you restore it. Report the criteria that passed, the
> proofs that caught their violation, and anything that could not run.

## Related skills

- `agent-ready-project`: the doctrine for a new project.
- `agent-ready-codebase`: the audit workflow for an existing repo.
- `agent-ready-typescript`: the TypeScript defaults and their templates.
- `agent-rules`: the rule table, auditor, and projector for multi-agent repos.
