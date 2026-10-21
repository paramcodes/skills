# Prompt to scaffold a new TypeScript project

Use both `agent-ready-codebase` and `agent-ready-typescript` skills to scaffold this project in the current directory.

Project goal: [describe the product]
Required stack/framework: [state it, or say you are open to a recommendation]
Runtime/deployment constraints: [if known]

Before coding, inspect the skills and select the matching TypeScript profile. Briefly state the selected stack and any assumptions, then implement the scaffold rather than stopping at a plan. Create the project-specific `AGENTS.md`, TypeScript config, lint/format/test commands, lockfile, and CI workflow. Adapt templates to the chosen framework and package manager; do not install optional tools without explaining why. Add one small example feature or smoke test only if it helps validate the scaffold. Run the actual verification commands and report exact results, any checks that could not run, and remaining risks. Do not deploy or publish anything.
