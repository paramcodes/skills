#!/usr/bin/env bash
#
# Installs the agent harness in a repository.
#
# Detects the package manager, copies the files that fit the stack, patches
# package.json with the harness scripts, and prints the adaptation checklist.
# It never overwrites a file that already exists unless --force is given.

set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
templates_dir="$skill_dir/templates"

repo=""
pm_override=""
project_override=""
force=0
dry_run=0

usage() {
  cat <<'USAGE'
usage: install-harness.sh <repo-path> [--pm pnpm|npm|yarn|bun] [--project <name>] [--force] [--dry-run]

  <repo-path>   the repository that receives the harness
  --pm          override the detected package manager
  --project     override the project name used in AGENTS.md
  --force       overwrite files that already exist
  --dry-run     print what would happen and change nothing
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --pm) pm_override="${2:-}"; shift 2 ;;
    --project) project_override="${2:-}"; shift 2 ;;
    --force) force=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) repo="$1"; shift ;;
  esac
done

if [ -z "$repo" ]; then
  usage >&2
  exit 1
fi

if [ ! -d "$repo" ]; then
  echo "install-harness: $repo is not a directory" >&2
  exit 1
fi

repo="$(cd "$repo" && pwd)"

if [ ! -f "$repo/package.json" ]; then
  echo "install-harness: $repo has no package.json, this installer is for JavaScript repositories" >&2
  exit 1
fi

read_json() {
  node -e '
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const value = process.argv[2].split(".").reduce((carry, key) => (carry ? carry[key] : undefined), data);
    process.stdout.write(value === undefined || value === null ? "" : String(value));
  ' "$repo/package.json" "$1"
}

detect_pm() {
  if [ -f "$repo/pnpm-lock.yaml" ]; then echo pnpm
  elif [ -f "$repo/bun.lockb" ] || [ -f "$repo/bun.lock" ]; then echo bun
  elif [ -f "$repo/yarn.lock" ]; then echo yarn
  elif [ -f "$repo/package-lock.json" ]; then echo npm
  else echo npm
  fi
}

pm="${pm_override:-$(detect_pm)}"

case "$pm" in
  pnpm) pm_exec="pnpm exec" ;;
  npm) pm_exec="npx" ;;
  yarn) pm_exec="yarn" ;;
  bun) pm_exec="bunx" ;;
  *) echo "install-harness: unknown package manager: $pm" >&2; exit 1 ;;
esac

project="${project_override:-$(read_json name)}"
if [ -z "$project" ]; then
  project="$(basename "$repo")"
fi

pm_version="$(read_json packageManager | sed "s/^${pm}@//")"
if [ -z "$pm_version" ]; then
  pm_version="latest"
fi

case "$pm" in
  pnpm)
    setup_steps="      - uses: pnpm/action-setup@v4
        with:
          version: ${pm_version}
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm"
    install_command="pnpm install --frozen-lockfile"
    ;;
  npm)
    setup_steps="      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm"
    install_command="npm ci"
    ;;
  yarn)
    setup_steps="      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: yarn
      - run: corepack enable"
    install_command="yarn install --immutable"
    ;;
  bun)
    setup_steps="      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22"
    install_command="bun install --frozen-lockfile"
    ;;
esac

render() {
  node -e '
    const fs = require("fs");
    const [source, target, project, pm, pmExec, setup, install] = process.argv.slice(1);
    let content = fs.readFileSync(source, "utf8");
    content = content
      .replace(/^[ \t]*# @@SETUP@@$/m, setup.trimEnd())
      .split("@@PROJECT@@").join(project)
      .split("@@INSTALL@@").join(install)
      .split("@@PM_EXEC@@").join(pmExec)
      .split("@@PM@@").join(pm)
      .split("{{PM_EXEC}}").join(pmExec)
      .split("{{PM}}").join(pm);
    fs.writeFileSync(target, content);
  ' "$1" "$2" "$project" "$pm" "$pm_exec" "$setup_steps" "$install_command"
}

installed_files=()

install_file() {
  local source="$templates_dir/$1"
  local target="$2"
  local mode="${3:-if-missing}"

  if [ "$mode" = "if-missing" ] && [ -e "$repo/$target" ] && [ "$force" -ne 1 ]; then
    printf 'skip    %s already exists\n' "$target"
    return 0
  fi

  if [ "$mode" = "always" ] && [ -e "$repo/$target" ] && [ "$force" -ne 1 ]; then
    printf 'skip    %s already exists, use --force to overwrite\n' "$target"
    return 0
  fi

  if [ "$dry_run" -eq 1 ]; then
    printf 'would   write %s\n' "$target"
    return 0
  fi

  mkdir -p "$(dirname "$repo/$target")"
  render "$source" "$repo/$target"
  installed_files+=("$target")
  printf 'write   %s\n' "$target"
}

has_eslint=0
if [ -f "$repo/eslint.config.js" ] || [ -f "$repo/eslint.config.mjs" ] || [ -f "$repo/eslint.config.ts" ]; then
  has_eslint=1
fi
if [ -n "$(read_json devDependencies.eslint)" ]; then
  has_eslint=1
fi

install_file "harness.config.json" "harness.config.json" always
install_file "scripts/harness-score.mjs" "scripts/harness-score.mjs" always
install_file "scripts/prove-guardrails.mjs" "scripts/prove-guardrails.mjs" always
install_file "scripts/guard-branch.sh" "scripts/guard-branch.sh" always
install_file "docs/ratchet.md" "docs/ratchet.md" if-missing
install_file "docs/mistake-log.md" "docs/mistake-log.md" if-missing
install_file "AGENTS.md" "AGENTS.md" if-missing
install_file "CLAUDE.md" "CLAUDE.md" if-missing
install_file "lefthook.yml" "lefthook.yml" if-missing
install_file "github-ci.yml" ".github/workflows/ci.yml" if-missing

if [ "$has_eslint" -eq 1 ]; then
  install_file "eslint.arch.mjs" "eslint.arch.mjs" always
  install_file "eslint-rules/index.mjs" "eslint-rules/index.mjs" always
  install_file "eslint.config.mjs" "eslint.config.mjs" if-missing
else
  printf 'skip    eslint files, this repository has no eslint\n'
fi

if [ ! -f "$repo/scripts/public-db-functions.txt" ]; then
  if [ "$dry_run" -eq 0 ]; then
    mkdir -p "$repo/scripts"
    cat >"$repo/scripts/public-db-functions.txt" <<'ALLOWLIST'
# Functions in the data layer that read rows nobody owns, so they take no actor id.
# Format: <function name> — <reason>
ALLOWLIST
  fi
  printf 'write   scripts/public-db-functions.txt\n'
fi

if [ "$dry_run" -eq 0 ]; then
  chmod +x "$repo/scripts/harness-score.mjs" "$repo/scripts/prove-guardrails.mjs" "$repo/scripts/guard-branch.sh"

  format_targets=()
  for target in "${installed_files[@]:-}"; do
    case "$target" in
      *.md|*.mjs|*.json|*.yml|*.yaml|*.ts|*.js) format_targets+=("$target") ;;
    esac
  done
  if [ "${#format_targets[@]}" -gt 0 ] && (cd "$repo" && $pm_exec prettier --version >/dev/null 2>&1); then
    (cd "$repo" && $pm_exec prettier --write "${format_targets[@]}" >/dev/null)
    printf 'format  %s files with the repository prettier\n' "${#format_targets[@]}"
  fi

  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const pm = process.argv[2];
    const pmExec = process.argv[3];
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.scripts = pkg.scripts ?? {};
    const wanted = {
      harness: "node scripts/harness-score.mjs",
      prove: "node scripts/prove-guardrails.mjs",
      arch: `${pmExec} eslint --config eslint.arch.mjs . --max-warnings=0`,
    };
    for (const [name, command] of Object.entries(wanted)) {
      if (!pkg.scripts[name]) pkg.scripts[name] = command;
    }
    const devDependencies = pkg.devDependencies ?? {};
    if (!pkg.scripts.prepare && devDependencies.lefthook) {
      pkg.scripts.prepare = `${pmExec} lefthook install`;
    }
    fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  ' "$repo/package.json" "$pm" "$pm_exec"
  printf 'patch   package.json scripts: harness, prove, arch\n'
fi

missing_scripts=""
for script in verify typecheck lint; do
  if [ -z "$(read_json "scripts.$script")" ]; then
    missing_scripts="$missing_scripts $script"
  fi
done

cat <<CHECKLIST

harness installed in $repo

next steps:
  1. Adapt harness.config.json. Set layers.data.alias, layers.data.dir, the file globs in
     layers.restricted, dataAccess.dir and dataAccess.actorPattern. Replace every criterion that
     does not apply to this stack with one that does, and record the replacement in the notes array.
  2. Merge the boundary and the local rules into eslint.config.mjs:
       import arch from "./eslint.arch.mjs";
       import { rules as localRules } from "./eslint-rules/index.mjs";
     add arch to the config array, add the plugin { local: { rules: localRules } }, and turn the
     escape hatches into errors with linterOptions.noInlineConfig, local/no-raw-json-parse,
     local/no-inline-config and @typescript-eslint/ban-ts-comment.
  3. Write the rules in AGENTS.md. Every bullet ends with "Enforced by: <path>", and the path must
     exist on disk. The harness fails when one does not.
  4. Add the missing package scripts.$missing_scripts
  5. Add lefthook, prettier and eslint as dev dependencies if this repository does not have them.
  6. Run $pm harness and $pm prove. Both must pass before the first commit.
  7. Keep the CI commands identical to the local ones, and let CI score the harness.
CHECKLIST
