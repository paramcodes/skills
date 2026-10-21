# Upstream Skill Sources

Every community skill referenced in [`catalog/`](../catalog), mapped to its canonical repository. Nothing here is vendored — install from source so `npx skills update` keeps it fresh.

| Collection / skill | Upstream repo | Category | Install |
|---|---|---|---|
| Matt Pocock skills | [mattpocock/skills](https://github.com/mattpocock/skills) ([Releases](https://github.com/mattpocock/skills/releases)) | engineering | `npx skills@latest add mattpocock/skills` **or** self-updating plugin `claude plugin install mattpocock-skills@claude-plugins-official` (pick one per agent) |
| Caveman | [juliusbrussee/caveman](https://github.com/juliusbrussee/caveman) | engineering | `npx skills add juliusbrussee/caveman` |
| Emil Kowalski skills | [emilkowalski/skills](https://github.com/emilkowalski/skills) | design & motion | `npx skills add emilkowalski/skills` |
| impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | design & motion | `npx skills add pbakaus/impeccable` |
| ui-ux-pro-max | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | design & motion | `npx skills add nextlevelbuilder/ui-ux-pro-max-skill` |
| good-css | [vojtaholik/good-css](https://github.com/vojtaholik/good-css) | design & motion | `npx skills add vojtaholik/good-css` |
| frontend-design | [anthropics/skills](https://github.com/anthropics/skills) | design & motion | `npx skills add anthropics/skills@frontend-design` |
| pstack (community/original) | [cursor/plugins → pstack](https://github.com/cursor/plugins/tree/main/pstack) | AI engineering | `/plugin install pstack@cursor-plugins` |
| vercel-react-best-practices | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | AI engineering | `npx skills add vercel-labs/agent-skills@vercel-react-best-practices` |
| gstack | [garrytan/gstack](https://github.com/garrytan/gstack) | devops | `npx skills add garrytan/gstack` |

## Personal skills in this repo

These live in [`skills/`](../skills) and are installed directly from this repo:

```bash
npx skills add paramcodes/skills -s <name> -g
```

| Skill | Notes |
|---|---|
| `pstack-loop`, `setup-pstack`, `poteto-help`, `poteto-mode` | Your customized OpenCode copy of pstack — **differs from upstream** |
| `principle-*` (24 skills) | Your engineering-principles set (pstack-derived, modified) |
| `control-cli`, `control-ui` | Harnesses for driving/inspecting CLIs, TUIs, and web/IDE/Electron UIs |
| `split-to-prs` | Split work into multiple PRs |
| `unslop` | Cut AI tells from writing |
| `autopilot` | Autonomous run mode |
| `performance-optimization` | Derived from [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills), customized |
| `bitter-workflow` | Project-specific rules for the "bitter" app |
| `productionize` | Productionize a feature |
| `no-comments` | Encode constraints instead of adding comments |
| `recall` | Recall from memory |
| `agent-ready-project` | Bootstrap a repo so agents can navigate, change, and self-verify (pit of success, paved road) |
| `agent-ready-codebase` | Audit and harden a repo so agents can modify it reliably across harnesses |
| `agent-ready-typescript` | TypeScript/ESLint/format/test/CI defaults for Node and browser repos |
| `agent-ready-harness` | Self-verifying harness: scored criteria, guardrail proofs, mistake ratchet |
| `agent-rules` | Machine-checkable rule table with a deterministic auditor, for repos where several agents write in parallel |
