# Agent-Ready Codebase skill

A reusable, stack-aware workflow for auditing and improving repositories so coding agents can work reliably across harnesses.

## What it does

- Inventories common project, testing, CI, quality, and agent-instruction files.
- Directs the agent to establish the current baseline before editing.
- Prioritizes a small number of high-value, evidence-backed improvements.
- Installs durable guardrails in the repository rather than relying only on prompts.
- Verifies guardrails and relevant behavior, then reports evidence and residual risks.

It intentionally does **not** install dependencies, modify repositories automatically, or claim to assess semantic code quality via the inventory script. The agent uses the report as a starting point and must inspect the actual project.

## Install

Choose the directory your harness discovers. The `SKILL.md` follows the open Agent Skills format; supported locations vary by tool and version.

Common options:

- Personal skill: `~/.agents/skills/agent-ready-codebase/`
- Project skill: `.agents/skills/agent-ready-codebase/`
- Other supported project locations include `.claude/skills/agent-ready-codebase/` and `.github/skills/agent-ready-codebase/`.

Copy the whole directory, not just `SKILL.md`, so the agent can consult the references, template, and audit script.

## Use

Ask a coding agent to:

> Use the `agent-ready-codebase` skill to audit and improve this repository. Preserve existing work, prioritize high-impact gaps, implement a few durable improvements, validate the new guardrails, and report exact evidence and remaining risks. Do not stop after producing a plan.

For audit-only mode, ask it to report findings and a prioritized plan without editing files.

## Included files

- `SKILL.md`: operating workflow and safety constraints.
- `scripts/audit_repo.py`: read-only inventory; Python 3.9+; no third-party dependencies.
- `references/quality-rubric.md`: prioritization and lint-rule calibration.
- `references/ci-contract.md`: suggested CI structure and trust checks.
- `assets/AGENTS.template.md`: portable root-instructions starter; customize before using.

## Compatibility notes

Skill discovery is not universal even where the Agent Skills standard is supported. Check the target harness's current skill-directory conventions. Keep essential project rules and enforcement in the repository itself (tests, lint/type configuration, scripts, CI); the skill is a workflow accelerator, not a required runtime dependency.

## Safety

Inspect skills from untrusted sources before installing them. This package's inventory script only reads directory entries and common filenames; the agent should still inspect project scripts before executing them.
