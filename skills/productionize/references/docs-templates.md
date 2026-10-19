# Docs and README media templates

## docs/ wiki skeleton

```
docs/
  README.md          # index: start here, concept list, reference list
  stack.md           # what / why / why not X per tool
  architecture.md    # app structure, data flow, folders, boundaries
  design-system.md   # tokens, components, motion, typography, scrollbars
  workflows.md        # dev, quality, git, PR, verification, worktrees
  roadmap.md         # phased plan with checkboxes
  PERF.md            # (or at repo root) performance ledger
  concepts/
    state-ownership.md
    persistence.md
    server-and-client.md
    # plus domain-specific concept guides
```

Each doc is short and decision-focused. Concepts teach a pattern shipped in real code, not a
generic definition. Reference docs list tools with "What / Why / Why not X".

## README.md (repo root) skeleton

- Title + one-line description + badges (CI status, deploy URL).
- Demo GIF/video + screenshots.
- Feature list (bulleted, concrete).
- Quick start (`pnpm install`, `pnpm dev`).
- Stack summary (link to docs/stack.md).
- Contributor guide (link to docs/workflows.md): commit convention, PR flow.
- Deploy notes (Vercel/Netlify/etc.) and env vars.
- License.

## Media capture script notes

`scripts/capture-readme.mjs` drives a running server with Playwright and writes screenshots plus
`demo.webm` into `artifacts/readme/`. Then `ffmpeg` derives `demo.mp4` and `demo.gif`.

- Env: `CAPTURE_BASE=http://localhost:3000`, `CAPTURE_OUT=artifacts/readme`.
- `CAPTURE_SHOTS=0` records only the video.
- Screenshots 1280x720; mobile 390x844 at 2x; video 1280x720.
- Run against a production build for faithful perf/media: `pnpm build && pnpm start`.
- Requires `ffmpeg` on PATH.
- Artifacts live under `artifacts/` (gitignored).

## Verification skill + feature map

`.opencode/skills/verify-<app>/` with `SKILL.md` and `features/*.md` recipes. Update recipes
whenever a feature changes behavior. Agents use this to prove work on the live surface instead of
guessing.

## Worktree handling

Ignore `.worktrees/` in vitest config and linting so a repo checked out inside the repo does not
double the test and lint surface. Add to `.gitignore` and to vitest `exclude`.
