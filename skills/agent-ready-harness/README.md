# Agent-ready harness

Installs the agent harness in a repository: a scored criteria list, guardrail proofs, a ratchet, and
an entry-point file whose rules name the file that enforces them.

The skill directory holds the doctrine in `SKILL.md`, the standard in
`references/harness-standard.md`, the ratchet procedure in `references/ratchet.md`, and the
installable files in `templates/`.

## Install

```bash
bash scripts/install-harness.sh /path/to/repo
```

The installer detects the package manager from the lockfile, copies the files that fit the stack,
patches `package.json` with the `harness` and `prove` scripts, and prints the adaptation
checklist. It refuses to overwrite an existing file.

## Files

| Path                                     | Purpose                                                   |
| ---------------------------------------- | --------------------------------------------------------- |
| `templates/harness.config.json`          | The criteria, the layers, the proof cases, and the notes. |
| `templates/scripts/harness-score.mjs`    | Scores every criterion. Exits non-zero on any failure.    |
| `templates/scripts/prove-guardrails.mjs` | Writes the bad code and proves the checker catches it.    |
| `templates/scripts/guard-branch.sh`      | Refuses work on the default branch.                       |
| `templates/eslint.arch.mjs`              | The layer boundary. Reads `harness.config.json`.          |
| `templates/eslint-rules/index.mjs`       | The local lint rules for the escape hatches.              |
| `templates/docs/ratchet.md`              | The mistake to guardrail procedure.                       |
| `templates/docs/mistake-log.md`          | The mistake log schema.                                   |
| `templates/AGENTS.md`                    | The entry-point file.                                     |
| `templates/CLAUDE.md`                    | The second entry point.                                   |
| `templates/lefthook.yml`                 | The local fast gate.                                      |
| `templates/github-ci.yml`                | The merge gate.                                           |

## License

MIT. See `LICENSE`.
