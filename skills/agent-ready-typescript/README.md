# Agent-Ready TypeScript pack

A stack-specific companion for the `agent-ready-codebase` skill. It provides conservative TypeScript defaults and examples for improving an existing project or scaffolding a new one. It is a **rule pack, not a full application starter**: it does not choose your framework, domain model, database, authentication, or deployment platform.

## Recommended use

1. Install the general `agent-ready-codebase` skill and this `agent-ready-typescript` skill in the skill directories your coding harness discovers.
2. Keep the source of both skills in a Git repository you control so you can version, review, and improve them.
3. For a new project, open an empty folder in Codex and explicitly ask it to use both skills. Tell it what you are building and any framework constraints. It should choose a profile, copy/adapt appropriate rules into the new repo, install only needed dependencies, and verify them.
4. For an existing project, invoke the TypeScript skill to audit and improve the current repo incrementally. Preserve healthy existing conventions and don't replace config files wholesale.
5. Commit the project's own `AGENTS.md`, TS configs, lint/format/test configs, scripts, lockfile, and CI workflow. These are the durable guarantees; they still work when the skill isn't loaded.

## Do I need GitHub?

No, not for local use. A GitHub repository is recommended as the canonical, version-controlled home for the skill and templates. It does **not** need to be cloned as an extra project dependency every time.

Use a GitHub **template repository** when you repeatedly want the same complete framework/application scaffold (for example, a React + Vite app). This pack alone is not a complete framework scaffold. For projects that need different architectures, start with an empty folder and ask Codex to use the installed skills; Codex should copy the chosen, adapted guardrails into that project's own repository.

Avoid making projects depend on a remote rules repo at runtime. A simple approach is to copy configuration snapshots into each project, then update them deliberately as your policy evolves. Later, if you have multiple projects that need centrally versioned lint policy, you can publish shared TypeScript/ESLint config as a versioned package.

## Template selection

- `templates/common/`: shared TypeScript compiler baseline, ESLint flat config, Prettier config, and package-script fragment.
- `templates/node-esm/`: Node.js ESM project settings. Confirm ESM package conventions and add `@types/node`.
- `templates/browser-react-vite/`: React + Vite browser project settings; assumes the matching framework/tooling dependencies exist.
- `templates/testing/`: optional standalone Vitest config for projects not already using a Vite config.
- `templates/github/`: npm-specific GitHub Actions workflow; adapt for pnpm, Yarn, Bun, workspaces, and the actual build/test scripts.

The npm CI example uses Node.js 24 as a starting point because it is Active LTS as of October 20, 2026. Check the official Node release page and your framework's support matrix before adopting or upgrading a runtime: https://nodejs.org/en/about/previous-releases

## Install dependencies when adopting the common TypeScript setup

Use the existing package manager. For npm, a typical starting point is:

```bash
npm install --save-dev typescript eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

For a Node project, also add `@types/node`. If using the optional Vitest example:

```bash
npm install --save-dev vitest
```

If using Vite/React, follow that framework's current installation instructions and merge test settings into the existing Vite config. These commands are examples; select compatible versions and commit the one authoritative lockfile.

## Important limits

- `eslint.config.mjs` uses the modern flat-config API and type-aware `typescript-eslint` presets. Confirm versions and TSConfig inclusion before adoption.
- Warnings for complexity, nesting, and parameter counts are prompts for review, not universal correctness rules. Tune from measured baseline.
- A linter does not replace runtime input validation, tests, authorization tests, end-to-end verification, review, or production controls.
- GitHub Actions major-version tags are readable examples. For stronger supply-chain assurance, pin actions to reviewed full commit SHAs and automate updates.

## Validate this pack

Run:

```bash
python3 scripts/validate_pack.py
```

This validates the package's JSON templates and JavaScript syntax when Node is available. It does not install dependencies or prove an arbitrary target project will pass after adoption.

## References

- typescript-eslint setup: https://typescript-eslint.io/getting-started/
- Type-aware linting: https://typescript-eslint.io/getting-started/typed-linting/
- Shared rule presets: https://typescript-eslint.io/users/configs/
- Vitest: https://vitest.dev/guide/
- Playwright test best practices: https://playwright.dev/docs/best-practices
- Codex skills: https://developers.openai.com/codex/skills
