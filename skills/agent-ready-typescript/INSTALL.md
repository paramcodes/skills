# Install and use this TypeScript skill with Codex

## Option A: Install both skills globally (recommended)

Copy the two skill directories `agent-ready-codebase/` and `agent-ready-typescript/` into your Codex skills directory. The default is usually `~/.codex/skills/`; if `CODEX_HOME` is set, use `$CODEX_HOME/skills/` instead. Check your Codex version's skill discovery settings if a skill does not appear.

The extracted layout should be:

```text
~/.codex/skills/
├── agent-ready-codebase/SKILL.md
└── agent-ready-typescript/SKILL.md
```

Do not flatten the folders: each skill needs its own directory containing `SKILL.md`, plus its supporting files.

## Prompt for a new TypeScript project

Open an empty project directory in Codex and use:

> Use `agent-ready-codebase` and `agent-ready-typescript` to scaffold this project. Goal: [your idea]. Required stack: [your framework, or ask me to choose]. Inspect the skills and choose the correct profile, then implement the scaffold in this directory. Make the project's own rules durable by creating/adapting `AGENTS.md`, TypeScript/lint/format/test configuration, a single lockfile, verification scripts, and CI. Preserve the chosen framework's official conventions. Do not stop at a plan; run the actual checks and report exact outcomes and remaining risks. Do not deploy or publish anything.

## Prompt for an existing project

> Use `agent-ready-codebase` and `agent-ready-typescript` to audit and harden this repository. Inspect existing work and baseline failures first. Preserve my package manager and framework, identify the 3–5 highest-value improvements, implement a small set, and verify the new guardrails. Do not replace healthy configuration wholesale or weaken tests/CI to make them pass. Report exact commands and results.

## Option B: Use a GitHub template

Use GitHub's **Use this template** flow only after you decide on a specific complete application starter (for example, React + Vite or a Node API). The skill pack itself is not a complete app template. Keep the two skills in your skill directory and keep project-specific guardrails committed in each project's repository.
