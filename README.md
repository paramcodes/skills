# paramcodes/skills

My personal collection of [Agent Skills](https://agentskills.io) — reusable instruction folders that teach coding agents (Claude Code, Codex, Cursor, etc.) how to do things my way.

## Install

```bash
# Interactive — pick skills and target agents
npx skills add paramcodes/skills

# Preview without installing
npx skills add paramcodes/skills --list

# Install specific skills globally
npx skills add paramcodes/skills -s <skill-name> -g
```

## Structure

```
skills/
└── <skill-name>/SKILL.md   # YAML frontmatter (name, description) + instructions
```

## Adding a skill

1. Create `skills/<skill-name>/SKILL.md` with `name` and `description` frontmatter.
2. Commit and push.
3. Run `npx skills add paramcodes/skills -s <skill-name> -g` to install.
