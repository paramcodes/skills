#!/usr/bin/env bash
#
# Installs the agent harness in a repository.
#
# Detects the package manager, copies the files that fit the stack, patches
# package.json with the harness scripts, adds the yaml dependency the scorer
# parses workflows with, adapts the criterion set to a second language
# toolchain, and prints the adaptation checklist.
# It never overwrites a file that already exists unless --force is given.

set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
templates_dir="$skill_dir/templates"

repo=""
pm_override=""
project_override=""
force=0
dry_run=0
install_deps=1

usage() {
  cat <<'USAGE'
usage: install-harness.sh <repo-path> [--pm pnpm|npm|yarn|bun] [--project <name>] [--force] [--dry-run] [--no-install]

  <repo-path>   the repository that receives the harness
  --pm          override the detected package manager
  --project     override the project name used in AGENTS.md
  --force       overwrite files that already exist
  --dry-run     print what would happen and change nothing
  --no-install  do not run the package manager to fetch the added dependency
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --pm) pm_override="${2:-}"; shift 2 ;;
    --project) project_override="${2:-}"; shift 2 ;;
    --force) force=1; shift ;;
    --dry-run) dry_run=1; shift ;;
    --no-install) install_deps=0; shift ;;
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
    local_install_command="pnpm install"
    ;;
  npm)
    setup_steps="      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm"
    install_command="npm ci"
    local_install_command="npm install"
    ;;
  yarn)
    setup_steps="      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: yarn
      - run: corepack enable"
    install_command="yarn install --immutable"
    local_install_command="yarn install"
    ;;
  bun)
    setup_steps="      - uses: oven-sh/setup-bun@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22"
    install_command="bun install --frozen-lockfile"
    local_install_command="bun install"
    ;;
esac

# The end-to-end command drives the app, so the behavioural criterion has
# something to run. The canonical name is test:e2e. A repository that calls the
# same suite something else gets an alias, so the criterion and the workflow
# keep one name.
e2e_script=""
for candidate in test:e2e e2e test:integration test:browser; do
  if [ -n "$(read_json "scripts.${candidate}")" ]; then
    e2e_script="$candidate"
    break
  fi
done

if [ -n "$e2e_script" ]; then
  e2e_command="$pm run $e2e_script"
else
  e2e_command="$pm run test:e2e"
fi

render() {
  node -e '
    const fs = require("fs");
    const [source, target, project, pm, pmExec, setup, install, e2e] = process.argv.slice(1);
    let content = fs.readFileSync(source, "utf8");
    content = content
      .replace(/^[ \t]*# @@SETUP@@$/gm, () => setup.trimEnd())
      .split("@@PROJECT@@").join(project)
      .split("@@INSTALL@@").join(install)
      .split("@@E2E@@").join(e2e)
      .split("@@PM_EXEC@@").join(pmExec)
      .split("@@PM@@").join(pm)
      .split("{{PM_EXEC}}").join(pmExec)
      .split("{{PM}}").join(pm);
    fs.writeFileSync(target, content);
  ' "$1" "$2" "$project" "$pm" "$pm_exec" "$setup_steps" "$install_command" "$e2e_command"
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

# The formatter of the repository. Every file the installer writes has to pass
# the format check of the repository it lands in, so the installer formats with
# the formatter the repository already has. The formatter of the repository is
# the one it installed, and then the one on the path. The installer never
# fetches a formatter, so it never changes the repository without saying so.
formatter=""
formatter_name=""

has_command() {
  command -v "$1" >/dev/null 2>&1
}

repo_formatter() {
  local name=""
  for name in prettier biome dprint; do
    if [ -x "$repo/node_modules/.bin/$name" ]; then
      echo "$name|$repo/node_modules/.bin/$name $(formatter_arguments "$name")"
      return 0
    fi
  done
}

formatter_arguments() {
  case "$1" in
    prettier) echo "--write" ;;
    biome) echo "format --write" ;;
    dprint) echo "fmt" ;;
  esac
}

format_with_repo() {
  local formatter_command="$1"
  shift
  if [ -z "$formatter_command" ]; then
    return 1
  fi
  (cd "$repo" && $formatter_command "$@") >/dev/null 2>&1
}

install_file "harness.config.json" "harness.config.json" always
install_file "scripts/harness-score.mjs" "scripts/harness-score.mjs" always
install_file "scripts/prove-guardrails.mjs" "scripts/prove-guardrails.mjs" always
install_file "scripts/guard-branch.sh" "scripts/guard-branch.sh" always
if [ -f "$templates_dir/scripts/prove-harness.mjs" ]; then
  install_file "scripts/prove-harness.mjs" "scripts/prove-harness.mjs" always
else
  printf 'warn    the self proof template is missing, this copy of the skill is incomplete\n'
fi
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
  if [ -f "$repo/scripts/prove-harness.mjs" ]; then
    chmod +x "$repo/scripts/prove-harness.mjs"
  fi

  formatter_info="$(repo_formatter)"
  formatter="${formatter_info#*|}"
  formatter_name="${formatter_info%%|*}"
  format_targets=()
  for target in "${installed_files[@]:-}"; do
    case "$target" in
      *.md|*.mjs|*.json|*.yml|*.yaml|*.ts|*.js) format_targets+=("$target") ;;
    esac
  done
  if [ "${#format_targets[@]}" -gt 0 ] && [ -n "$formatter" ]; then
    if format_with_repo "$formatter" "${format_targets[@]}"; then
      printf 'format  %s files with the repository %s\n' "${#format_targets[@]}" "$formatter_name"
    else
      printf 'warn    the repository formatter failed on the installed files, run it by hand\n'
    fi
  fi

  node -e '
    const fs = require("fs");
    const file = process.argv[1];
    const pm = process.argv[2];
    const pmExec = process.argv[3];
    const e2eScript = process.argv[4];
    const pkg = JSON.parse(fs.readFileSync(file, "utf8"));
    pkg.scripts = pkg.scripts ?? {};
    const wanted = {
      harness: "node scripts/harness-score.mjs",
      prove: "node scripts/prove-guardrails.mjs",
      "prove-harness": "node scripts/prove-harness.mjs",
      arch: `${pmExec} eslint --config eslint.arch.mjs . --max-warnings=0`,
    };
    for (const [name, command] of Object.entries(wanted)) {
      if (!pkg.scripts[name]) pkg.scripts[name] = command;
    }
    if (e2eScript && !pkg.scripts["test:e2e"]) {
      pkg.scripts["test:e2e"] = pkg.scripts[e2eScript];
    }
    if (!pkg.scripts.prepare && (pkg.devDependencies?.lefthook ?? pkg.dependencies?.lefthook)) {
      pkg.scripts.prepare = `${pmExec} lefthook install`;
    }
    const devDependencies = pkg.devDependencies ?? {};
    if (!devDependencies.yaml && !pkg.dependencies?.yaml) {
      devDependencies.yaml = "^2.9.1";
      pkg.devDependencies = devDependencies;
    }
    fs.writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  ' "$repo/package.json" "$pm" "$pm_exec" "$e2e_script"
  printf 'patch   package.json scripts: harness, prove, prove-harness, arch, and the yaml dependency\n'
fi

# The second toolchain. A repository with two languages holds both of them to a
# gate, and the criterion set says so.
detect_toolchain() {
  if [ -f "$repo/pyproject.toml" ] || [ -f "$repo/setup.py" ] || [ -f "$repo/requirements.txt" ]; then
    echo python
  elif [ -f "$repo/Cargo.toml" ]; then
    echo rust
  elif [ -f "$repo/go.mod" ]; then
    echo go
  elif [ -f "$repo/Gemfile" ]; then
    echo ruby
  else
    echo ""
  fi
}

toolchain_gate() {
  case "$1" in
    python)
      if has_command ruff; then echo "ruff check ."; return; fi
      if has_command python3; then echo "python3 -m compileall -q ."; return; fi
      if has_command python; then echo "python -m compileall -q ."; return; fi
      ;;
    rust)
      if has_command cargo; then echo "cargo clippy --all-targets -- -D warnings"; return; fi
      ;;
    go)
      if has_command go; then echo "go vet ./..."; return; fi
      ;;
    ruby)
      if has_command bundle; then echo "bundle exec rubocop"; return; fi
      if has_command ruby; then echo "ruby -c"; return; fi
      ;;
  esac
  echo ""
}

toolchain="$(detect_toolchain)"
toolchain_gate_command=""
toolchain_gate_display=""
toolchain_why=""
toolchain_note=""

if [ -n "$toolchain" ]; then
  toolchain_gate_command="$(toolchain_gate "$toolchain")"
  if [ -n "$toolchain_gate_command" ]; then
    toolchain_gate_display="$toolchain_gate_command"
    toolchain_why="the $toolchain toolchain is gated too"
    toolchain_note="Replaced the second-toolchain criterion with the $toolchain gate ($toolchain_gate_command) because this repository has a second language toolchain."
  else
    toolchain_why="the $toolchain toolchain is not gated yet, on purpose, until a gate command for it is installed"
    toolchain_note="This repository has a second language toolchain ($toolchain) and no gate command for it, so the second-toolchain criterion keeps the gate of this repository on purpose and the $toolchain toolchain stays ungated until a gate command for it is installed."
  fi
else
  toolchain_gate_command=""
  for candidate in lint typecheck test build verify; do
    if [ -n "$(read_json "scripts.${candidate}")" ]; then
      toolchain_gate_command="\${PM} run $candidate"
      toolchain_gate_display="$pm run $candidate"
      break
    fi
  done
  if [ -n "$toolchain_gate_command" ]; then
    toolchain_why="the one toolchain of this repository is gated"
    toolchain_note="Replaced the second-toolchain criterion with the repository gate ($toolchain_gate_display) because this repository has one language toolchain."
  fi
fi

if [ "$dry_run" -eq 0 ]; then
  if [ -n "$toolchain_note" ]; then
    if [ -n "$toolchain_gate_command" ]; then
      adapt_result="$(node -e '
        const fs = require("fs");
        const file = process.argv[1];
        const idPattern = new RegExp(process.argv[2], "i");
        const check = JSON.parse(process.argv[3]);
        const why = process.argv[4];
        const note = process.argv[5];
        const config = JSON.parse(fs.readFileSync(file, "utf8"));
        const criteria = Array.isArray(config.criteria) ? config.criteria : [];
        const index = criteria.findIndex((criterion) => idPattern.test(criterion.id ?? ""));
        if (index === -1) {
          config.notes = [...(config.notes ?? []), note];
          fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
          process.stdout.write("no-match");
          process.exit(0);
        }
        criteria[index] = { ...criteria[index], why, check };
        config.criteria = criteria;
        config.notes = [...(config.notes ?? []), note];
        fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
        process.stdout.write("adapted");
      ' "$repo/harness.config.json" "toolchain|polyglot" "{\"type\":\"command\",\"run\":\"$toolchain_gate_command\"}" "$toolchain_why" "$toolchain_note")"
      case "$adapt_result" in
        adapted) printf 'adapt   the second-toolchain criterion: %s\n' "$toolchain_gate_display" ;;
        *) printf 'warn    no criterion matches the second-toolchain slot, adapt it by hand\n' ;;
      esac
    else
      adapt_result="$(node -e '
        const fs = require("fs");
        const file = process.argv[1];
        const idPattern = new RegExp(process.argv[2], "i");
        const why = process.argv[3];
        const note = process.argv[4];
        const config = JSON.parse(fs.readFileSync(file, "utf8"));
        const criteria = Array.isArray(config.criteria) ? config.criteria : [];
        const index = criteria.findIndex((criterion) => idPattern.test(criterion.id ?? ""));
        if (index !== -1) {
          criteria[index] = { ...criteria[index], why };
          config.criteria = criteria;
        }
        config.notes = [...(config.notes ?? []), note];
        fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
        process.stdout.write(index === -1 ? "no-match" : "recorded");
      ' "$repo/harness.config.json" "toolchain|polyglot" "$toolchain_why" "$toolchain_note")"
      case "$adapt_result" in
        recorded)
          printf 'warn    the %s toolchain has no gate command, the second-toolchain criterion keeps the gate of this repository on purpose\n' "$toolchain"
          ;;
        *)
          printf 'warn    the %s toolchain has no gate command and no criterion matches the second-toolchain slot, adapt it by hand\n' "$toolchain"
          ;;
      esac
    fi
  fi
fi

# The toolchain patch writes the config again, so the config is formatted after
# the patch. A file the format check of the repository rejects fails the
# repository own verify command on a fresh install, and the scratch tree needs
# no ignore file to get past it.
if [ "$dry_run" -eq 0 ]; then
  if [ -n "$formatter" ]; then
    if format_with_repo "$formatter" harness.config.json; then
      printf 'format  harness.config.json with the repository %s\n' "$formatter_name"
    else
      printf 'warn    the repository formatter failed on harness.config.json, run it by hand\n'
    fi
  elif node -e '
    const fs = require("fs");
    const path = require("path");

    const configFile = process.argv[1];
    const root = process.argv[2];

    function jsonFiles(root, skip) {
      const names = [];
      let entries = [];
      try {
        entries = fs.readdirSync(root, { withFileTypes: true });
      } catch {
        return names;
      }
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name === skip) continue;
        if (entry.name.endsWith(".json") || entry.name.endsWith(".jsonc")) {
          names.push(entry.name);
        }
      }
      return names;
    }

    // The shape of the JSON files the repository already has. A formatter keeps a
    // short array on one line and breaks a long one, so the files the repository
    // already holds say which of the two it does.
    function learnShape(root, skip) {
      let collapse = true;
      let width = 80;

      for (const name of jsonFiles(root, skip)) {
        let text;
        try {
          text = fs.readFileSync(path.join(root, name), "utf8");
        } catch {
          continue;
        }
        const lines = text.split("\n");

        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index];
          const trimmed = line.trim();
          const indent = line.length - line.trimStart().length;

          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            if (trimmed === "[]") continue;
            width = Math.max(width, line.length);
            continue;
          }

          if (!trimmed.endsWith("[")) continue;

          // An array the repository broke over several lines. When it holds only
          // scalars and would fit on one line, the repository breaks what a
          // formatter that keeps short arrays joins.
          const inner = [];
          let cursor = index + 1;
          while (cursor < lines.length && !lines[cursor].trim().startsWith("]")) {
            inner.push(lines[cursor].trim());
            cursor += 1;
          }
          if (cursor >= lines.length) continue;
          if (inner.some((item) => item.includes("{") || item.includes("["))) continue;
          const items = inner.map((item) => item.replace(/,$/, ""));
          const single = "[" + items.join(", ") + "]";
          const prefix = trimmed.length - 1;
          if (indent + prefix + single.length <= 80) collapse = false;
        }
      }

      return { collapse, width };
    }

    function isScalar(value) {
      return value === null || typeof value !== "object";
    }

    // Every object stays expanded, the way the template writes them, and an array
    // of scalars goes on one line when it fits the width of the repository. The
    // prefix is what stands on the line before the value.
    function print(value, indent, shape, prefix) {
      if (isScalar(value)) return JSON.stringify(value);
      const pad = " ".repeat(indent + 2);

      if (Array.isArray(value)) {
        if (value.length === 0) return "[]";
        const parts = value.map((item) => print(item, indent + 2, shape, 0));
        if (shape.collapse && value.every(isScalar)) {
          const single = "[" + parts.join(", ") + "]";
          if (indent + prefix + single.length <= shape.width) return single;
        }
        return (
          "[\n" +
          parts.map((part) => pad + part).join(",\n") +
          "\n" +
          " ".repeat(indent) +
          "]"
        );
      }

      const entries = Object.entries(value);
      if (entries.length === 0) return "{}";
      return (
        "{\n" +
        entries
          .map(
            ([key, item]) =>
              pad + JSON.stringify(key) + ": " + print(item, indent + 2, shape, key.length + 2),
          )
          .join(",\n") +
        "\n" +
        " ".repeat(indent) +
        "}"
      );
    }

    const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
    const shape = learnShape(root, path.basename(configFile));
    fs.writeFileSync(configFile, print(config, 0, shape, 0) + "\n");
  ' "$repo/harness.config.json" "$repo"; then
    printf 'warn    this repository has no formatter, harness.config.json is written in the shape of the JSON files this repository already has, run your formatter over the installed files before the first commit\n'
  else
    printf 'warn    this repository has no formatter and the shape of harness.config.json could not be learned from it, run your formatter over the installed files before the first commit\n'
  fi
fi

if [ "$dry_run" -eq 0 ] && [ "$install_deps" -eq 1 ]; then
  if has_command "$pm"; then
    if (cd "$repo" && timeout 600 $local_install_command >/dev/null 2>&1); then
      printf 'install the yaml dependency with %s\n' "$local_install_command"
    else
      printf 'warn    the dependency install failed, run `%s install` to fetch the yaml package\n' "$pm"
    fi
  else
    printf 'warn    %s is not on the path, run `%s install` to fetch the yaml package\n' "$pm" "$pm"
  fi
fi

missing_scripts=""
for script in verify typecheck lint test:e2e; do
  if [ -z "$(read_json "scripts.$script")" ]; then
    missing_scripts="$missing_scripts $script"
  fi
done

format_step=""
if [ -z "$formatter" ]; then
  format_step="  8. Run the formatter of this repository over the installed files. The installer found
     none, so the files keep the shape of the template.
"
fi

cat <<CHECKLIST

harness installed in $repo

next steps:
  1. Adapt harness.config.json. Set layers.data.alias, layers.data.dir, the file globs in
     layers.restricted, dataAccess.dir and dataAccess.actorPattern. Replace every criterion that
     does not apply to this stack with one that does, keep the criterion id, and record the
     replacement in the notes array.
  2. Merge the boundary and the local rules into eslint.config.mjs:
       import arch from "./eslint.arch.mjs";
       import { rules as localRules } from "./eslint-rules/index.mjs";
     add arch to the config array, add the plugin { local: { rules: localRules } }, and turn the
     escape hatches into errors with linterOptions.noInlineConfig, local/no-raw-json-parse,
     local/no-inline-config and @typescript-eslint/ban-ts-comment.
  3. Write the rules in AGENTS.md. Every bullet ends with "Enforced by: <kind>:<path>", where the
     kind is config, file, command or document, and the path must exist on disk. The harness fails
     when one does not, and when the path does not enforce anything.
  4. Add the missing package scripts.$missing_scripts
  5. Add lefthook, prettier and eslint as dev dependencies if this repository does not have them.
  6. Run $pm run harness, $pm run prove and $pm run prove-harness. All three must pass before the
     first commit.
  7. Keep the CI commands identical to the local ones, and let CI score the harness.
$format_step
CHECKLIST
