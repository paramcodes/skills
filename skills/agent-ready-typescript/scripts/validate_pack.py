#!/usr/bin/env python3
"""Validate the static TypeScript pack templates without installing project dependencies."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_FILES = [
    ROOT / "templates/common/tsconfig.base.json",
    ROOT / "templates/common/package-scripts.fragment.json",
    ROOT / "templates/node-esm/tsconfig.json",
    ROOT / "templates/browser-react-vite/tsconfig.json",
]
JS_FILES = [
    ROOT / "templates/common/eslint.config.mjs",
    ROOT / "templates/common/prettier.config.mjs",
]


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def main() -> None:
    for path in JSON_FILES:
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            fail(f"invalid JSON: {path.relative_to(ROOT)}: {exc}")
        print(f"PASS JSON {path.relative_to(ROOT)}")

    for path in JS_FILES:
        if not path.exists():
            fail(f"missing template: {path.relative_to(ROOT)}")
        if shutil.which("node"):
            result = subprocess.run(
                ["node", "--check", str(path)],
                text=True,
                capture_output=True,
                check=False,
            )
            if result.returncode != 0:
                fail(f"JavaScript syntax check failed for {path.relative_to(ROOT)}:\n{result.stderr}")
            print(f"PASS JS syntax {path.relative_to(ROOT)}")
        else:
            print(f"SKIP JS syntax (Node unavailable): {path.relative_to(ROOT)}")

    required = [
        ROOT / "SKILL.md",
        ROOT / "README.md",
        ROOT / "references/rule-policy.md",
        ROOT / "references/project-profiles.md",
        ROOT / "references/ci-and-verification.md",
        ROOT / "templates/github/verify-npm.yml",
    ]
    for path in required:
        if not path.is_file():
            fail(f"required file missing: {path.relative_to(ROOT)}")
    print(f"PASS required file checks ({len(required)} files)")
    print("NOTE: this validates template syntax and package contents, not a full installed project.")


if __name__ == "__main__":
    main()
