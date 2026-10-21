#!/usr/bin/env python3
"""Read-only repository inventory for the agent-ready-codebase skill.

This script only inspects paths and common configuration markers. It does not
install dependencies, run project code, edit files, or claim semantic quality.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Tuple

SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "vendor", "dist", "build",
    "target", ".next", ".nuxt", "coverage", ".coverage", "__pycache__",
    ".venv", "venv", "env", ".tox", ".mypy_cache", ".pytest_cache",
    ".ruff_cache", "out", "bin", "obj", "Pods", ".turbo", ".cache",
}
MAX_FILES = 100_000

STACK_MARKERS = {
    "JavaScript/TypeScript": ["package.json", "tsconfig.json", "pnpm-workspace.yaml"],
    "Python": ["pyproject.toml", "requirements.txt", "Pipfile", "uv.lock", "poetry.lock"],
    "Go": ["go.mod", "go.work"],
    "Rust": ["Cargo.toml", "Cargo.lock"],
    "Java/Kotlin": ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle.kts"],
    ".NET": ["global.json", "Directory.Build.props", "*.sln", "*.csproj"],
    "PHP": ["composer.json", "composer.lock"],
    "Ruby": ["Gemfile", "Gemfile.lock"],
    "Elixir": ["mix.exs", "mix.lock"],
}

INSTRUCTION_PATHS = [
    "AGENTS.md", "CLAUDE.md", "GEMINI.md", "COPILOT_INSTRUCTIONS.md",
    ".github/copilot-instructions.md", ".cursor/rules", ".agents",
    ".claude/CLAUDE.md", ".github/skills", ".agents/skills", ".claude/skills",
]
CI_PATHS = [
    ".github/workflows", ".gitlab-ci.yml", ".buildkite", "Jenkinsfile",
    "azure-pipelines.yml", ".circleci/config.yml", "bitbucket-pipelines.yml",
]
QUALITY_PATHS = [
    "eslint.config.js", "eslint.config.mjs", ".eslintrc", ".eslintrc.json",
    "biome.json", "biome.jsonc", ".prettierrc", "prettier.config.js",
    "ruff.toml", ".ruff.toml", "mypy.ini", ".golangci.yml",
    "clippy.toml", "rustfmt.toml", "sonar-project.properties",
    ".pre-commit-config.yaml", "lefthook.yml", ".husky",
]


def rel(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root)).replace(os.sep, "/")
    except ValueError:
        return str(path)


def walk_files(root: Path) -> Tuple[List[Path], bool]:
    found: List[Path] = []
    capped = False
    for current, dirs, filenames in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not (Path(current) / d).is_symlink()]
        current_path = Path(current)
        for filename in filenames:
            path = current_path / filename
            if path.is_file() or path.is_symlink():
                found.append(path)
                if len(found) >= MAX_FILES:
                    capped = True
                    return found, capped
    return found, capped


def exists_any(root: Path, items: List[str], files: List[Path]) -> List[str]:
    file_names = {p.name for p in files}
    found: List[str] = []
    for item in items:
        if "*" in item:
            suffix = item.replace("*", "")
            matches = sorted(rel(p, root) for p in files if p.name.endswith(suffix))
            if matches:
                found.extend(matches[:10])
        elif (root / item).exists() or item in file_names:
            found.append(item)
    return list(dict.fromkeys(found))


def collect(root_arg: str) -> Dict[str, object]:
    root = Path(root_arg).expanduser().resolve()
    if not root.exists() or not root.is_dir():
        raise ValueError("Repository path must exist and be a directory: %s" % root)
    files, capped = walk_files(root)
    file_set = {rel(p, root) for p in files}
    base_names = {p.name for p in files}

    stack_hits: Dict[str, List[str]] = {}
    for stack, markers in STACK_MARKERS.items():
        hits = []
        for marker in markers:
            if "*" in marker:
                suffix = marker.replace("*", "")
                hits.extend(sorted(n for n in file_set if Path(n).name.endswith(suffix))[:10])
            else:
                if marker in file_set or marker in base_names:
                    hits.append(marker if marker in file_set else "…/" + marker)
        if hits:
            stack_hits[stack] = list(dict.fromkeys(hits))

    test_like = [rel(p, root) for p in files if (
        p.name.startswith("test_") or p.name.endswith("_test.py") or
        p.name.endswith(".test.ts") or p.name.endswith(".test.tsx") or
        p.name.endswith(".spec.ts") or p.name.endswith(".spec.tsx") or
        p.name.endswith(".test.js") or p.name.endswith(".spec.js") or
        p.name.endswith("_test.go") or p.name.endswith(".rs") and "tests" in p.parts or
        "/tests/" in ("/" + rel(p, root) + "/") or
        "/__tests__/" in ("/" + rel(p, root) + "/")
    )]

    package_scripts: List[str] = []
    package_path = root / "package.json"
    if package_path.is_file():
        try:
            package_json = json.loads(package_path.read_text(encoding="utf-8"))
            scripts = package_json.get("scripts", {})
            if isinstance(scripts, dict):
                package_scripts = sorted(str(k) for k in scripts.keys())
        except (OSError, json.JSONDecodeError):
            package_scripts = ["<could not parse package.json>"]

    instructions = exists_any(root, INSTRUCTION_PATHS, files)
    ci = exists_any(root, CI_PATHS, files)
    quality = exists_any(root, QUALITY_PATHS, files)
    lockfile_names = [
        "pnpm-lock.yaml", "package-lock.json", "yarn.lock", "bun.lockb", "bun.lock",
        "uv.lock", "poetry.lock", "Pipfile.lock", "Cargo.lock", "go.sum",
        "Gemfile.lock", "composer.lock", "mix.lock",
    ]
    lockfiles = [name for name in lockfile_names if name in file_set or name in base_names]
    test_dirs = sorted({
        rel(p, root) for p in files
        if p.is_dir() and p.name.lower() in {"test", "tests", "__tests__", "spec", "specs"}
    })

    findings: List[Dict[str, str]] = []
    if not ci:
        findings.append({"priority": "P1", "finding": "No common CI configuration marker detected", "next_step": "Inspect the hosting platform and add required automated checks if this repository is merged/deployed collaboratively."})
    if not test_like:
        findings.append({"priority": "P1", "finding": "No common test-file pattern detected", "next_step": "Confirm whether tests live in a nonstandard location; add targeted regression coverage before adding coverage thresholds."})
    if not instructions:
        findings.append({"priority": "P2", "finding": "No common agent-instruction location detected", "next_step": "Consider a concise AGENTS.md that documents true project commands and architectural boundaries."})
    if stack_hits and any(k in stack_hits for k in ("JavaScript/TypeScript", "Python", "Rust", "Go", "Ruby", "PHP")) and not lockfiles:
        findings.append({"priority": "P2", "finding": "No common dependency lockfile detected for a stack that often uses one", "next_step": "Check the project's package-manager policy; some libraries or repositories intentionally do not commit lockfiles."})
    if not quality:
        findings.append({"priority": "P2", "finding": "No common lint/format/quality config marker detected", "next_step": "Inspect manifests and CI: a tool may be configured elsewhere or built into the language; do not add a duplicate tool blindly."})
    if not package_scripts and "JavaScript/TypeScript" in stack_hits:
        findings.append({"priority": "P2", "finding": "No npm package scripts detected", "next_step": "Inspect the package manager/workspace setup and document the real canonical verification commands."})
    if capped:
        findings.append({"priority": "INFO", "finding": "File inventory reached the safety cap", "next_step": "Treat counts and absence-based findings as incomplete for this large repository."})

    return {
        "root": str(root),
        "files_scanned": len(files),
        "inventory_capped": capped,
        "detected_stack_markers": stack_hits,
        "agent_instructions": instructions,
        "ci_markers": ci,
        "quality_config_markers": quality,
        "lockfiles": lockfiles,
        "test_like_files_count": len(test_like),
        "test_like_samples": test_like[:20],
        "package_scripts": package_scripts,
        "findings": findings,
        "limitations": [
            "Read-only inventory only; it does not inspect semantic correctness or execute project commands.",
            "A missing marker is not proof a tool is absent; configuration may be generated, custom, or stored elsewhere.",
            "Verify all findings against the repository's actual conventions before changing files."
        ],
    }


def render_markdown(data: Dict[str, object]) -> str:
    lines = [
        "# Repository inventory",
        "",
        "- Root: `%s`" % data["root"],
        "- Files scanned: %s%s" % (data["files_scanned"], " (capped)" if data["inventory_capped"] else ""),
        "- Test-like files found: %s" % data["test_like_files_count"],
        "",
        "## Stack markers",
    ]
    stacks = data["detected_stack_markers"]
    if stacks:
        for stack, hits in stacks.items():
            lines.append("- **%s:** %s" % (stack, ", ".join("`%s`" % h for h in hits)))
    else:
        lines.append("- No known stack markers found; inspect the repository manually.")
    lines += ["", "## Existing engineering setup"]
    lines.append("- Agent instructions: %s" % (", ".join("`%s`" % x for x in data["agent_instructions"]) or "No common marker found"))
    lines.append("- CI markers: %s" % (", ".join("`%s`" % x for x in data["ci_markers"]) or "No common marker found"))
    lines.append("- Quality config: %s" % (", ".join("`%s`" % x for x in data["quality_config_markers"]) or "No common marker found"))
    lines.append("- Lockfiles: %s" % (", ".join("`%s`" % x for x in data["lockfiles"]) or "No common marker found"))
    if data["package_scripts"]:
        lines.append("- `package.json` scripts: %s" % ", ".join("`%s`" % x for x in data["package_scripts"]))
    lines += ["", "## Suggested investigation"]
    findings = data["findings"]
    if findings:
        for f in findings:
            lines.append("- **%s — %s.** %s" % (f["priority"], f["finding"], f["next_step"]))
    else:
        lines.append("- No absence-based suggestions triggered. Inspect quality and behavior directly; this inventory is not a quality pass.")
    lines += ["", "## Limitations"]
    for item in data["limitations"]:
        lines.append("- %s" % item)
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", nargs="?", default=".", help="Repository path (default: current directory)")
    parser.add_argument("--format", choices=("markdown", "json"), default="markdown")
    args = parser.parse_args()
    try:
        data = collect(args.repo)
    except ValueError as exc:
        print("error: %s" % exc, file=sys.stderr)
        return 2
    if args.format == "json":
        print(json.dumps(data, indent=2))
    else:
        print(render_markdown(data), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
