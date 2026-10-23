#!/usr/bin/env node
/**
 * Architecture & file-size guard. Zero dependencies. Node 18+.
 *
 * Scans whole files (not single lines), strips comments first, and resolves
 * every module specifier from: static import/export ... from "x", side-effect
 * import "x", dynamic import("x"), and require("x").
 *
 * Codes:
 *  ARCH-01 barrel file (index.*) under src/
 *  ARCH-02 generic filename (utils/helpers/common) under src/
 *  ARCH-03 cross-feature import of a non-contract file
 *  ARCH-04 UI/React import inside a backend, domain, or calc layer
 *  ARCH-05 database client imported outside repo files and src/server/
 *  SIZE-01 source file over MAX_LINES (tests excluded)
 *
 * Limits (by design, stated so they are not mistaken for guarantees):
 *  - Comment stripping is lexical. A `//` inside a string literal is treated
 *    as a comment start only when not preceded by ':' (keeps URLs intact).
 *  - Specifiers built at runtime (import(variable)) cannot be resolved.
 *  - Run `node --test scripts/` to check this script against its own fixtures.
 */
import * as fs from "node:fs";
import * as path from "node:path";

export const MAX_LINES = 400;
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

export function stripComments(src) {
  // block comments, then line comments not part of a URL
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

// Matches module specifiers across newlines.
const SPEC_PATTERNS = [
  /\bimport\s+(?:type\s+)?[\s\S]*?\bfrom\s*["']([^"']+)["']/g, // import x from / import {\n a\n} from
  /\bexport\s+(?:type\s+)?[\s\S]*?\bfrom\s*["']([^"']+)["']/g, // export * from / export {x} from
  /\bimport\s*["']([^"']+)["']/g,                              // import "side-effect"
  /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,                    // dynamic import("x")
  /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,                   // require("x")
];

export function extractSpecifiers(src) {
  const code = stripComments(src);
  const found = new Map(); // specifier -> first line number
  for (const re of SPEC_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code)) !== null) {
      const line = code.slice(0, m.index).split("\n").length;
      const spec = m[1];
      if (!found.has(spec)) found.set(spec, line);
    }
  }
  return [...found.entries()].map(([spec, line]) => ({ spec, line }));
}

function rel(root, file) {
  return path.relative(root, file).split(path.sep).join("/");
}

export function auditFile(root, file, src) {
  const r = rel(root, file);
  const base = path.posix.basename(r);
  const out = [];
  const v = (code, line, message, remediation) =>
    out.push({ code, file: r, line, message, remediation });

  if (/^index\.(ts|tsx|js|jsx|mjs|cjs)$/.test(base)) {
    v("ARCH-01", undefined, `Barrel file '${base}' is forbidden.`,
      "Delete it and import the concrete module directly, e.g. './cards.service'. See docs/ADR/001-no-barrel-files.md.");
  }
  if (/^(utils|helpers|common)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(base)) {
    v("ARCH-02", undefined, `Generic filename '${base}' is forbidden.`,
      "Rename with a domain and role suffix: pure algorithms go to src/shared/calc/<name>.calc.ts, UI helpers to src/shared/ui/<name>.util.ts.");
  }
  const lineCount = src.split("\n").length;
  if (!/\.test\./.test(base) && lineCount > MAX_LINES) {
    v("SIZE-01", undefined, `File has ${lineCount} lines (max ${MAX_LINES}).`,
      "Extract pure helpers to src/shared/calc/*.calc.ts or split the module by responsibility, then re-run the check.");
  }

  const feature = (r.match(/^src\/features\/([^/]+)\//) || [])[1] || null;
  const isPure =
    r.startsWith("src/server/") || r.startsWith("src/shared/calc/") ||
    r.startsWith("src/shared/kernel/") || /\.repo\.(ts|js)$/.test(r) ||
    /\.service\.(ts|js)$/.test(r);
  const isDataLayer = r.startsWith("src/server/") || /\.repo\.(ts|js)$/.test(r) || /\.test\./.test(base);

  for (const { spec, line } of extractSpecifiers(src)) {
    // ARCH-03: cross-feature. Resolve relative specs against the file, then
    // read the feature name from the resolved path so "../boards/x" and
    // "features/boards/x" are treated the same.
    if (feature) {
      const resolved = spec.startsWith(".")
        ? path.posix.normalize(path.posix.join(path.posix.dirname(r), spec))
        : spec;
      const m = resolved.match(/(?:^|\/)features\/([^/]+)\/(.+)$/);
      if (m && m[1] !== feature) {
        const target = m[2];
        const isContract = /\.(schema|contract)(\.(ts|tsx|js|mjs))?$/.test(target);
        if (!isContract) {
          v("ARCH-03", line, `Feature '${feature}' imports internals of '${m[1]}': '${spec}'.`,
            `Feature '${feature}' may import only '${m[1]}/${m[1]}.schema' or '${m[1]}/${m[1]}.contract'. Move shared logic into a service that orchestrates both, or into src/shared/.`);
        }
      }
    }
    // ARCH-04: UI in pure layers
    if (isPure && (/\/components\//.test(spec) || /shared\/ui/.test(spec) || /\.tsx?$/.test(spec) ||
        spec === "react" || spec === "react-dom" || spec.startsWith("react/"))) {
      v("ARCH-04", line, `UI or React import '${spec}' inside a pure layer.`,
        "Keep *.service.ts, *.repo.ts, src/server/*, src/shared/calc/* and src/shared/kernel/* free of UI imports. Move rendering into components/ or src/shared/ui/.");
    }
    // ARCH-05: DB client outside repo/server
    if (!isDataLayer && (/server\/db/.test(spec) || spec === "@prisma/client" || spec.startsWith("drizzle-orm"))) {
      v("ARCH-05", line, `Database import '${spec}' outside a repo file.`,
        "Only *.repo.ts files and src/server/db/* may import the database client. Call a repo method from services and routes.");
    }
  }
  return out;
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (CODE_EXT.test(e.name) && !e.name.endsWith(".d.ts")) acc.push(p);
  }
  return acc;
}

export function runCheck(root) {
  const srcDir = path.join(root, "src");
  const files = walk(srcDir);
  const violations = files.flatMap((f) => auditFile(root, f, fs.readFileSync(f, "utf8")));
  return { files: files.length, violations };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { files, violations } = runCheck(process.cwd());
  if (violations.length === 0) {
    console.log(`✅ Architecture & size check passed across ${files} files.`);
    process.exit(0);
  }
  console.error(`\n✖ ${violations.length} architectural violation(s):\n`);
  for (const v of violations) {
    console.error(`✖ [${v.code}] ${v.file}${v.line ? ":" + v.line : ""}`);
    console.error(`  Problem:     ${v.message}`);
    console.error(`  Remediation: ${v.remediation}\n`);
  }
  process.exit(1);
}
