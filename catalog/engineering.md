# Engineering

Workflow, planning, review, and day-to-day engineering discipline.

## Matt Pocock — `mattpocock/skills`

> Skills for real engineers. Small, composable, model-agnostic. The most-used community collection.

**Install the whole set (interactive picker):**

```bash
npx skills@latest add mattpocock/skills
```

**Install a single skill:**

```bash
npx skills@latest add mattpocock/skills@<skill-name>
# e.g. npx skills@latest add mattpocock/skills@grill-me
```

Browse: [github.com/mattpocock/skills](https://github.com/mattpocock/skills) · [aihero.dev/skills](https://aihero.dev/skills) · [Releases](https://github.com/mattpocock/skills/releases) · [skills.sh](https://skills.sh/mattpocock/skills)

### Releases & self-updating plugin

The repo is **versioned** — see [Releases](https://github.com/mattpocock/skills/releases) (semver tags `v1.x.y`, latest **`v1.3.1`**). Each release carries a full changelog with **Major / Minor / Patch** sections and explicit **Breaking** callouts (e.g. new `codebase-design` / `domain-modeling` dependencies, removed skills), so you can see exactly what changed before pulling.

There are **two install paths — pick one per agent**, or you'll get every skill twice:

| Method | Updates | Best for |
|--|--|--|
| **Plugin** | Updates itself | Claude Code, Codex, Copilot |
| **`npx skills`** (this repo's default) | Manual — `npx skills@latest update` | Cursor, OpenCode, DevIn, Windsurf, Amp, Pi, or editable files |

**Plugin installs (self-updating):**

```bash
# Claude Code (official marketplace)
claude plugin install mattpocock-skills@claude-plugins-official

# Codex
codex plugin marketplace add mattpocock/skills
codex plugin add mattpocock-skills@mattpocock

# GitHub Copilot (CLI + VS Code)
copilot plugin marketplace add mattpocock/skills
copilot plugin install mattpocock-skills@mattpocock
# then add mattpocock to extraKnownMarketplaces in ~/.copilot/settings.json with "autoUpdate": true

# Gemini CLI (manual re-run to update)
gemini skills install https://github.com/mattpocock/skills.git --path skills/engineering
gemini skills install https://github.com/mattpocock/skills.git --path skills/productivity
```

> When the installer asks which skills to take, **include `setup-matt-pocock-skills`** — run it once per repo to wire up your issue tracker, triage labels, and docs location. Full setup details in the [README](https://github.com/mattpocock/skills#installation-30-second-setup).

Highlights: `grill-me` · `grilling` · `grill-with-docs` · `code-review` · `pr` · `tdd` · `implement` · `implement-spec` · `to-spec` · `to-tickets` · `triage` · `handoff` · `teach` · `wait-what` · `wayfinder` · `wizard` · `codebase-design` · `domain-modeling` · `diagnosing-bugs` · `research` · `retro` · `chief-of-staff` · `writing-for-agents`

## Caveman — `juliusbrussee/caveman`

> Terse, no-fluff agent communication style with a crew of helper skills.

```bash
npx skills add juliusbrussee/caveman
```

Browse: [github.com/juliusbrussee/caveman](https://github.com/juliusbrussee/caveman)

Includes: `caveman` · `cavecrew` · `caveman-commit` · `caveman-compress` · `caveman-review` · `caveman-stats` · `megacave` · `ultracave`

## Related personal skills in this repo

- `split-to-prs` — split work into multiple PRs
- `autopilot` — autonomous run mode
- `productionize` — productionize a feature
- `no-comments` — encode constraints instead of commenting
- `agent-ready-project` / `agent-ready-codebase` / `agent-ready-typescript` / `agent-ready-harness` / `agent-rules` — the agent-ready suite: doctrine, audit workflow, TypeScript defaults, the self-verifying harness, and the machine-checkable rule table
