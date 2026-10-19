# paramcodes/skills

My personal collection of [Agent Skills](https://agentskills.io) — plus a curated catalogue of the community skill collections I use.

## Layout

```
catalog/            # Community skill collections — linked to original repos (not vendored)
├── engineering.md          # Matt Pocock, caveman
├── design-and-motion.md    # Emil Kowalski, impeccable, ui-ux-pro-max, good-css, frontend-design
├── ai-engineering.md       # pstack, vercel-react-best-practices
├── security.md             # (planned)
└── devops.md               # gstack
skills/             # MY personal skills — installable directly from this repo
└── <skill-name>/SKILL.md
sources/
└── upstream-skills.md      # Every community skill → canonical repo + install command
```

- **Community skills** are *not* copied here. Each `catalog/*.md` page links to the upstream repo with its install command, so `npx skills update` keeps them fresh.
- **Personal skills** live in `skills/` and are installed straight from this repo.

## Install

```bash
# Interactive — pick skills and target agents
npx skills add paramcodes/skills

# Preview without installing
npx skills add paramcodes/skills --list

# Install specific personal skills globally
npx skills add paramcodes/skills -s <skill-name> -g
```

Community collections are installed from their own repos — see [`sources/upstream-skills.md`](sources/upstream-skills.md) or the relevant page in [`catalog/`](catalog).

## Adding a personal skill

1. Create `skills/<skill-name>/SKILL.md` with `name` and `description` frontmatter.
2. Commit and push.
3. Run `npx skills add paramcodes/skills -s <skill-name> -g` to install.
