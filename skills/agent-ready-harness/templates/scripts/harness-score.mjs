#!/usr/bin/env node
/**
 * Scores the agent harness against the criteria in harness.config.json.
 *
 * Every criterion runs a real check against this repository. A criterion passes
 * only when its check passes. The script exits 0 only when every criterion
 * passes, and it prints the reason for every failure.
 *
 * A criterion never checks for a word. A check either runs the thing it
 * describes, or it reads a structure a change could break: the steps of a
 * workflow file, the sections of a procedure, the rows of a log, the resolved
 * behaviour of a lint rule. A file that keeps the words of a rule while losing
 * the rule fails the check.
 *
 * The criteria the harness holds live in this file, not only in
 * `harness.config.json`, so that editing the config alone cannot weaken the
 * gate: a criterion that is deleted, renamed or duplicated fails the score, and
 * a command criterion that stops running the command it is supposed to run
 * fails the score too.
 *
 * The scorer writes probe files into the tree to run the linter, and it leaves
 * the tree exactly as it found it, on every exit path: a normal run, a thrown
 * error, an interrupt, a termination. A run that was killed outright cannot
 * clean up after itself, so it leaves a journal outside the tree, and the next
 * run restores the tree from that journal before it writes anything of its own.
 * Only one run may own a tree at a time, so two runs cannot fight over the
 * same probe file.
 *
 * `node scripts/harness-score.mjs --only <criterion>` scores one criterion.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const argv = process.argv.slice(2);
const onlyFlag = argv.indexOf("--only");
const only = onlyFlag === -1 ? null : (argv[onlyFlag + 1] ?? null);
const positional = argv.filter(
  (value, index) =>
    !value.startsWith("--") && !(onlyFlag !== -1 && index === onlyFlag + 1),
);

const root = path.resolve(positional[0] ?? process.cwd());
process.chdir(root);

const configPath = process.env.HARNESS_CONFIG ?? "harness.config.json";

function die(message) {
  console.error(`harness: ${message}`);
  process.exit(1);
}

if (!existsSync(configPath)) die(`${configPath} is missing`);

let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch (error) {
  die(`${configPath} is not valid JSON: ${error.message}`);
}

const packageManager = config.packageManager ?? "pnpm";
const execCommand = config.commands?.exec ?? `${packageManager} exec`;
const criteria = Array.isArray(config.criteria) ? config.criteria : [];

/**
 * The criteria the harness holds.
 *
 * The list lives in this file, not only in `harness.config.json`, so that
 * editing the config alone cannot weaken the gate. A criterion that is
 * deleted, renamed or duplicated fails the score.
 *
 * Adding a criterion is allowed. It is a deliberate act of editing this list
 * and of raising `minimumCriteria` in the config in the same commit.
 */
const EXPECTED_CRITERION_IDS = [
  "boundaries",
  "data-access",
  "proofs",
  "escape-hatches",
  "entry-point",
  "local-gate",
  "ci",
  "ratchet",
  "mistake-log",
  "verify",
  "behavioral",
  "artifact",
  "second-toolchain",
];

/**
 * The proof cases the harness holds.
 *
 * The list lives in this file and in `scripts/prove-guardrails.mjs`, so that
 * editing `harness.config.json` alone cannot weaken the gate. The two files
 * must hold the same names, and the scorer reads the prover to prove it.
 */
const EXPECTED_PROOF_NAMES = [
  "a domain file imports the data layer",
  "a component imports the data layer",
  "a page imports the data layer",
  "a domain file imports a component",
  "a component imports the domain layer",
  "the source tree carries an inline lint config",
  "the source tree carries a ts-expect-error",
  "the source tree carries a skipped test",
  "the source tree parses raw JSON",
  "the mistake log criterion fails when a row names no guardrail",
  "the mistake log criterion fails when a row names a guardrail that does not exist",
  "the entry point criterion fails when a rule names no kind",
  "the scorer restores its probe when it is killed with a signal",
  "the scorer repairs a tree that a killed run left dirty",
];

function expand(text, probe) {
  return String(text)
    .replaceAll("${PM}", packageManager)
    .replaceAll("${PM_EXEC}", execCommand)
    .replaceAll("${DATA_ALIAS}", config.layers?.data?.alias ?? "@/db")
    .replaceAll("${PROBE}", probe ?? "");
}

/**
 * A command that exits 0 without proving anything. A criterion that runs one
 * of these scores as if it had checked the thing it names.
 */
const NOOP_COMMANDS = new Set([
  "true",
  "false",
  ":",
  "0",
  "exit 0",
  "exit 1",
  "echo",
  "echo hit",
  "noop",
  "nothing",
  "yes",
]);

function isNoopCommand(command) {
  const trimmed = String(command).trim();
  if (trimmed === "") return true;
  if (NOOP_COMMANDS.has(trimmed)) return true;
  if (NOOP_COMMANDS.has(trimmed.toLowerCase())) return true;
  if (/^echo\s*$/.test(trimmed)) return true;
  if (/(\|\|\s*true|;\s*true)\s*$/.test(trimmed)) return true;
  return false;
}

/**
 * The checker runs in a child process without blocking the event loop. A
 * blocking call would swallow the interrupt that stops this script, which is
 * the one signal the operator can always send.
 */
let runningChild = null;

function run(command) {
  return new Promise((resolve) => {
    const child = spawn(expand(command), {
      shell: true,
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    runningChild = child;

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) => {
      if (runningChild === child) runningChild = null;
      resolve({ code: 1, output: `${output}${error.message}`.trim() });
    });
    child.on("close", (code) => {
      if (runningChild === child) runningChild = null;
      resolve({
        code: typeof code === "number" ? code : 1,
        output: output.trim(),
      });
    });
  });
}

function tail(text, lines = 6) {
  const rows = String(text).trim().split("\n");
  return rows.slice(-lines).join("\n");
}

/**
 * The tree discipline.
 *
 * The scorer writes probe files into the tree to run the linter. The tree must
 * be left exactly as it was found, on every exit path. The journal holds the
 * state of the files the scorer is about to overwrite, and it lives outside the
 * tree, so a run that was killed outright still leaves a record that the next
 * run restores.
 */
const treeHash = createHash("sha256").update(root).digest("hex").slice(0, 12);
const journalPath = path.join(
  os.tmpdir(),
  `harness-scorer-journal-${treeHash}.json`,
);

/**
 * The lock of the run.
 *
 * Two runs of the scorer on one tree fight over the same probe file, and the
 * loser leaves a probe behind in the tree, which then fails the format check.
 * The lock makes the tree the resource of one run: the second run waits for
 * the first to finish and refuses when the wait runs out.
 *
 * The lock lives outside the tree, so a run that was killed outright cannot
 * leave it in the repository. A lock whose owner is gone is broken, so a
 * killed run never blocks the next one.
 *
 * The lock is not the lock of the prover. The scorer runs the prover, and the
 * two must not wait for each other.
 */
const lockPath = path.join(os.tmpdir(), `harness-scorer-lock-${treeHash}.lock`);

/** The milliseconds a run waits for the lock before it refuses to run. */
const lockWaitMs = Number(process.env.HARNESS_LOCK_WAIT_MS ?? 120_000);

/** The milliseconds after which a lock without a readable owner is stale. */
const lockStaleMs = Number(process.env.HARNESS_LOCK_STALE_MS ?? 60_000);

/** Sleeps without blocking the event loop for longer than it has to. */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * True when the lock belongs to a process that is gone.
 */
function lockOwnerIsGone() {
  let holder;
  try {
    holder = JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {
    try {
      return Date.now() - statSync(lockPath).mtimeMs > lockStaleMs;
    } catch {
      return true;
    }
  }

  if (typeof holder?.pid !== "number") return false;
  try {
    process.kill(holder.pid, 0);
    return false;
  } catch (error) {
    return error.code === "ESRCH";
  }
}

/**
 * Takes the lock of the tree.
 */
function acquireLock() {
  const deadline = Date.now() + lockWaitMs;

  for (;;) {
    try {
      const handle = openSync(lockPath, "wx");
      try {
        writeFileSync(
          handle,
          JSON.stringify({ pid: process.pid, startedAt: Date.now() }),
        );
      } finally {
        closeSync(handle);
      }
      return true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }

    if (lockOwnerIsGone()) {
      const stalePath = `${lockPath}.stale-${process.pid}-${Date.now()}`;
      try {
        renameSync(lockPath, stalePath);
        rmSync(stalePath, { force: true });
      } catch {
        // Another run broke the same lock first. It holds it now.
      }
      continue;
    }

    if (Date.now() >= deadline) return false;
    sleep(250);
  }
}

/**
 * Releases the lock of the run. Only the owner releases it.
 */
function releaseLock() {
  try {
    const holder = JSON.parse(readFileSync(lockPath, "utf8"));
    if (holder?.pid !== process.pid) return;
  } catch {
    return;
  }
  rmSync(lockPath, { force: true });
}

let pendingFiles = [];
let journalWritten = false;

function writeJournal() {
  try {
    writeFileSync(journalPath, JSON.stringify({ root, pendingFiles }, null, 2));
    journalWritten = true;
  } catch {
    // The journal is a backup for a run that cannot clean up after itself. A
    // failure to write it must not stop the run.
  }
}

/**
 * Restores every file the scorer touched. A file the scorer created and that
 * did not exist before is removed. A file that existed before comes back
 * exactly as it was. It is safe to call twice, and it is called on every exit
 * path.
 */
function restoreTree() {
  for (const entry of [...pendingFiles].reverse()) {
    try {
      if (entry.existed) writeFileSync(entry.path, entry.content);
      else rmSync(entry.path, { force: true });
    } catch (error) {
      console.error(
        `harness: could not restore ${entry.path}: ${error.message}`,
      );
    }
  }
  pendingFiles = [];

  // The journal belongs to the run that wrote it. A run that never wrote one
  // must not remove the journal of the run that holds the tree.
  if (!journalWritten) return;
  journalWritten = false;
  rmSync(journalPath, { force: true });
}

/**
 * A run that was killed outright cannot clean up after itself. The journal it
 * left behind holds the content of every file it overwrote, so the next run
 * puts the tree back before it writes anything of its own.
 */
function recoverStaleProbes() {
  if (!existsSync(journalPath)) return;

  try {
    const stale = JSON.parse(readFileSync(journalPath, "utf8"));
    if (stale.root === root && Array.isArray(stale.pendingFiles)) {
      for (const entry of stale.pendingFiles) {
        if (entry.existed) writeFileSync(entry.path, entry.content);
        else rmSync(entry.path, { force: true });
      }
      console.log(
        `harness: restored ${stale.pendingFiles.length} probe file(s) left behind by an earlier run`,
      );
    }
  } catch (error) {
    console.error(
      `harness: could not read the probe journal: ${error.message}`,
    );
  }

  rmSync(journalPath, { force: true });
}

function onSignal(signal) {
  if (runningChild) {
    runningChild.kill("SIGKILL");
    runningChild = null;
  }
  restoreTree();
  releaseLock();
  console.error(`\nharness: ${signal} received, the tree was restored`);
  process.exit(128 + (os.constants.signals[signal] ?? 0));
}

/**
 * The run owns the tree before it touches it.
 *
 * The lock is taken before the stale probes are repaired, so two runs can
 * never repair the same probe at the same time.
 */
if (!acquireLock()) {
  console.error(
    `harness: another run holds the lock of this tree and did not finish within ${lockWaitMs} ms`,
  );
  process.exit(1);
}

recoverStaleProbes();

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => onSignal(signal));
}

process.on("exit", () => {
  restoreTree();
  releaseLock();
});

process.on("uncaughtException", (error) => {
  restoreTree();
  releaseLock();
  console.error(error);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  restoreTree();
  releaseLock();
  console.error(error);
  process.exit(1);
});

function walk(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

function exportedFunctions(source) {
  const found = [];
  const pattern = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g;
  let match = pattern.exec(source);
  while (match) {
    const start = pattern.lastIndex;
    let index = start;
    let depth = 1;
    while (index < source.length && depth > 0) {
      const character = source[index];
      if (character === "(" || character === "{" || character === "[")
        depth += 1;
      else if (character === ")" || character === "}" || character === "]")
        depth -= 1;
      index += 1;
    }
    found.push({ name: match[1], params: source.slice(start, index - 1) });
    match = pattern.exec(source);
  }
  return found;
}

function readAllowlist(file) {
  const allowlist = new Map();
  if (!file || !existsSync(file)) return allowlist;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(\S+)\s*(?:—|::|--)\s*(.+)$/);
    if (!match) {
      throw new Error(`${file} has an entry without a reason: ${trimmed}`);
    }
    allowlist.set(match[1], match[2].trim());
  }
  return allowlist;
}

/**
 * Loads the YAML parser. The `yaml` package is a dependency of the harness.
 * A project without it cannot check a workflow file, and the check fails
 * rather than the run.
 */
function loadYaml() {
  try {
    const require = createRequire(import.meta.url);
    return require("yaml");
  } catch {
    return null;
  }
}

/**
 * Every `run` value in a YAML document, with the map that holds it. The map
 * holds the `if` of the step, so a step that is guarded off can be told from
 * a step that runs.
 */
function collectRunEntries(node, trail, found) {
  if (Array.isArray(node)) {
    node.forEach((item, index) =>
      collectRunEntries(item, [...trail, index], found),
    );
    return found;
  }
  if (!node || typeof node !== "object") return found;
  for (const [key, value] of Object.entries(node)) {
    if (key === "run" && typeof value === "string") {
      found.push({ value, trail, siblings: node });
      continue;
    }
    collectRunEntries(value, [...trail, key], found);
  }
  return found;
}

function describeTrail(trail) {
  return trail.length === 0 ? "the document" : trail.join(".");
}

/**
 * Removes the package manager prefix from a command, so that `pnpm exec
 * eslint --max-warnings=0` and `eslint --max-warnings=0` name the same
 * command.
 */
function stripPackageManager(text) {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;
  const managers = new Set([
    "pnpm",
    "npm",
    "yarn",
    "bun",
    "npx",
    "bunx",
    "pnpx",
  ]);
  let index = 0;
  if (managers.has(tokens[0])) {
    const next = tokens[1];
    if (next === "run" || next === "exec" || next === "dlx") index = 2;
    else if (next !== undefined) index = 1;
    else return text;
  }
  return tokens.slice(index).join(" ");
}

/**
 * True when the command runs the required command. The comparison is on
 * whole tokens, so `prove` never matches `prove-harness`.
 */
function runsCommand(effective, required) {
  const actual = effective.split(/\s+/).filter(Boolean);
  const wanted = required.split(/\s+/).filter(Boolean);
  if (wanted.length === 0 || actual.length < wanted.length) return false;
  return wanted.every((token, index) => actual[index] === token);
}

function swallowsFailure(line) {
  return /(\|\|\s*true\b|;\s*true\b)/.test(line);
}

/**
 * The lines of a `run` value that could run a command. A line that only
 * prints the command, comments it out, or quotes it, runs nothing.
 */
function commandLines(runValue) {
  const lines = runValue.split("\n").map((line) => line.trim());
  return lines.filter((line) => {
    if (line === "") return false;
    if (line.startsWith("#")) return false;
    if (/^(echo|printf)\b/.test(line)) return false;
    if (line.startsWith('"') || line.startsWith("'")) return false;
    return true;
  });
}

const checks = {
  async command(check) {
    const command = String(check.run ?? "");
    if (isNoopCommand(command)) {
      return {
        ok: false,
        reason: `the criterion proves nothing: \`${command.trim()}\` exits 0 without checking anything`,
      };
    }
    const result = await run(command);
    if (result.code !== 0) {
      return {
        ok: false,
        reason: `\`${expand(command)}\` exited ${result.code}`,
        detail: tail(result.output),
      };
    }
    if (check.contains && !result.output.includes(check.contains)) {
      return {
        ok: false,
        reason: `\`${expand(command)}\` did not print ${check.contains}`,
        detail: tail(result.output),
      };
    }
    return { ok: true };
  },

  async behavioral(check) {
    const command = String(check.run ?? "");
    if (isNoopCommand(command)) {
      return {
        ok: false,
        reason: `the criterion proves nothing: \`${command.trim()}\` exits 0 without driving the app`,
      };
    }
    const result = await run(command);
    if (result.code !== 0) {
      return {
        ok: false,
        reason: `the end to end command \`${expand(command)}\` exited ${result.code}`,
        detail: tail(result.output, 12),
      };
    }
    if (check.contains && !result.output.includes(check.contains)) {
      return {
        ok: false,
        reason: `the end to end command \`${expand(command)}\` did not print ${check.contains}`,
        detail: tail(result.output),
      };
    }
    return { ok: true };
  },

  fileExists(check) {
    if (!existsSync(check.path))
      return { ok: false, reason: `${check.path} is missing` };
    return { ok: true };
  },

  fileContains(check) {
    if (!existsSync(check.path))
      return { ok: false, reason: `${check.path} is missing` };
    const content = readFileSync(check.path, "utf8");
    const missing = (check.contains ?? []).filter(
      (needle) => !content.includes(needle),
    );
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `${check.path} does not contain: ${missing.join(", ")}`,
      };
    }
    return { ok: true };
  },

  fileMaxLines(check) {
    if (!existsSync(check.path))
      return { ok: false, reason: `${check.path} is missing` };
    const lines = readFileSync(check.path, "utf8").trimEnd().split("\n").length;
    if (lines > check.max) {
      return {
        ok: false,
        reason: `${check.path} has ${lines} lines, the limit is ${check.max}`,
      };
    }
    return { ok: true };
  },

  grepCount(check) {
    if (!existsSync(check.path))
      return { ok: false, reason: `${check.path} is missing` };
    const content = readFileSync(check.path, "utf8");
    const matches =
      content.match(new RegExp(check.pattern, check.flags ?? "gm")) ?? [];
    if (check.min !== undefined && matches.length < check.min) {
      return {
        ok: false,
        reason: `${check.path} has ${matches.length} matches, at least ${check.min} are required`,
      };
    }
    if (check.max !== undefined && matches.length > check.max) {
      return {
        ok: false,
        reason: `${check.path} has ${matches.length} matches, at most ${check.max} are allowed`,
      };
    }
    return { ok: true };
  },

  async node(check) {
    // The scratch file lives outside the tree, and it is removed when the
    // check ends, so the check leaves nothing behind anywhere.
    const directory = mkdtempSync(path.join(tmpdir(), "harness-"));
    const file = path.join(directory, "check.mjs");
    try {
      writeFileSync(file, check.script);
      const result = await run(`node ${file}`);
      if (result.code !== 0) {
        return {
          ok: false,
          reason: `the node check exited ${result.code}`,
          detail: tail(result.output),
        };
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    return { ok: true };
  },

  /**
   * Reads the steps of a YAML file and asserts that each required command
   * runs. A command that is commented out, guarded by `if: false`, printed by
   * `echo`, or followed by `|| true` does not count, and the failure says
   * why each candidate step did not count.
   */
  yamlSteps(check) {
    if (!existsSync(check.path))
      return { ok: false, reason: `${check.path} is missing` };

    const yaml = loadYaml();
    if (!yaml) {
      return {
        ok: false,
        reason: `the yaml package is missing, add it to the dev dependencies to check ${check.path}`,
      };
    }

    const raw = readFileSync(check.path, "utf8");
    let document;
    try {
      document = yaml.parse(raw);
    } catch (error) {
      return {
        ok: false,
        reason: `${check.path} is not valid YAML: ${error.message}`,
      };
    }

    const entries = collectRunEntries(document, [], []);
    const problems = [];

    for (const requirement of check.required ?? []) {
      const wanted =
        typeof requirement === "string" ? requirement : requirement.command;
      const alternatives = Array.isArray(requirement)
        ? requirement
        : (requirement.oneOf ?? [wanted]);

      const found = alternatives.find((candidate) =>
        entries.some((entry) => stepRuns(entry, candidate)),
      );
      if (found !== undefined) continue;

      for (const candidate of alternatives) {
        const reasons = entries.map((entry) => {
          const reason = stepDoesNotRun(entry, candidate);
          return `the step at ${describeTrail(entry.trail)}: ${reason}`;
        });
        const inComment = raw
          .split("\n")
          .some(
            (line) => line.trim().startsWith("#") && line.includes(candidate),
          );
        if (inComment) {
          reasons.push(`the command appears in a comment, which runs nothing`);
        }
        if (reasons.length === 0) {
          reasons.push(`the file holds no step that runs a command`);
        }
        problems.push(
          `${check.path} does not run \`${candidate}\`\n    ${reasons.join("\n    ")}`,
        );
      }
    }

    if (problems.length > 0) {
      return {
        ok: false,
        reason: `${check.path} does not run what the rule requires`,
        detail: problems.join("\n"),
      };
    }
    return { ok: true };
  },

  /**
   * Runs the linter against a probe file that breaks each named rule and
   * asserts the linter failed with that rule. A rule that is commented out,
   * switched off, or renamed fails the check, because the linter no longer
   * fails on the code the rule was made for.
   *
   * The probe is registered in the journal before it is written, so a run that
   * is killed between the write and the restore leaves a record that the next
   * run uses to put the tree back.
   */
  async lintRules(check) {
    const problems = [];
    const probes = check.rules ?? [];

    if (probes.length === 0) {
      return { ok: false, reason: "the check names no rule to prove" };
    }

    for (const probe of probes) {
      const target = path.join(root, probe.path);
      const existed = existsSync(target);
      const content = existed ? readFileSync(target, "utf8") : null;

      pendingFiles.push({ path: target, existed, content });
      writeJournal();

      try {
        mkdirFor(target);
        writeFileSync(target, expand(probe.content ?? "", probe.path));

        const command = probe.run ?? check.run;
        if (!command) {
          problems.push(`${probe.name} names no command that runs the linter`);
          continue;
        }
        const result = await run(expand(command, probe.path));
        if (result.code === 0) {
          problems.push(
            `${probe.name}: the linter exited 0 on a file that breaks ${probe.rule}`,
          );
          continue;
        }
        if (!result.output.includes(probe.rule)) {
          problems.push(
            `${probe.name}: the linter did not report ${probe.rule}, it reported:\n${tail(result.output, 8)}`,
          );
        }
      } finally {
        restoreTree();
      }
    }

    if (problems.length > 0) {
      return {
        ok: false,
        reason: `${problems.length} rules do not bite`,
        detail: problems.join("\n"),
      };
    }
    return { ok: true };
  },

  /**
   * Reads the sections of a markdown document. The named sections must exist
   * as headings or as bolded section titles. A word that only appears in a
   * paragraph is not a section.
   */
  documentSections(check) {
    if (!existsSync(check.path))
      return { ok: false, reason: `${check.path} is missing` };

    const content = readFileSync(check.path, "utf8");
    const titles = documentTitles(content);
    const problems = [];

    for (const section of check.sections ?? []) {
      const wanted = normalizeTitle(section);
      const found = titles.some((title) => {
        const normalized = normalizeTitle(title);
        return normalized === wanted || normalized.includes(wanted);
      });
      if (!found) {
        problems.push(
          `${check.path} holds no section titled ${section}, it holds: ${titles.join(", ") || "no title"}`,
        );
      }
    }

    if (problems.length > 0) {
      return {
        ok: false,
        reason: `${check.path} does not hold the whole procedure`,
        detail: problems.join("\n"),
      };
    }
    return { ok: true };
  },

  /**
   * Reads the rows of a log table. The table must hold its schema, and every
   * row it holds must name a guardrail that exists on disk.
   *
   * A log with no rows passes. A fresh repository has made no mistakes, and a
   * gate that demands a row forces a repository to invent one. The check
   * holds the shape of the rows that exist, and it says out loud that the log
   * is empty.
   */
  logRows(check) {
    if (!existsSync(check.path))
      return { ok: false, reason: `${check.path} is missing` };

    // An example row inside an HTML comment shows the shape without being a
    // row, so the comment is removed before the table is read.
    const content = readFileSync(check.path, "utf8").replace(
      /<!--[\s\S]*?-->/g,
      "",
    );
    const table = content
      .split("\n")
      .filter((line) => line.trim().startsWith("|"))
      .map((line) => splitRow(line));

    if (table.length < 2) {
      return { ok: false, reason: `${check.path} holds no table` };
    }

    const header = table[0];
    const rows = table.slice(2);
    const minimum = check.minRows ?? 0;
    const problems = [];

    const guardrailColumn = findGuardrailColumn(header, check.guardrailColumn);
    if (guardrailColumn === -1) {
      return {
        ok: false,
        reason: `${check.path} holds no guardrail column, it holds: ${header.join(", ")}`,
      };
    }

    const filled = rows.filter((row) => row.some((cell) => cell !== ""));
    if (filled.length < minimum) {
      problems.push(
        `${check.path} holds ${filled.length} rows, at least ${minimum} are required`,
      );
    }

    for (const [index, row] of filled.entries()) {
      if (row.length < header.length) {
        problems.push(
          `row ${index + 1} of ${check.path} holds ${row.length} cells, the table holds ${header.length}`,
        );
        continue;
      }

      const cell = row[guardrailColumn] ?? "";
      if (cell === "") {
        problems.push(`row ${index + 1} of ${check.path} names no guardrail`);
        continue;
      }
      const paths = cell
        .split(/[\s,;]+/)
        .map((token) => token.replace(/[`"'()]/g, ""))
        .filter((token) => token !== "" && looksLikePath(token));
      if (paths.length === 0) {
        problems.push(
          `row ${index + 1} of ${check.path} names no guardrail path, it names ${cell}`,
        );
        continue;
      }
      const existing = paths.filter((name) =>
        existsSync(path.join(root, name)),
      );
      if (existing.length === 0) {
        problems.push(
          `row ${index + 1} of ${check.path} names ${paths.join(", ")}, none of which exists`,
        );
      }
    }

    if (problems.length > 0) {
      return {
        ok: false,
        reason: `${check.path} does not hold a row for every mistake`,
        detail: problems.join("\n"),
      };
    }

    if (filled.length === 0) {
      return {
        ok: true,
        note: "the repository has recorded no mistakes yet",
      };
    }

    return { ok: true };
  },

  /**
   * Reads the rules of the entry point file. Every rule names an
   * enforcement path and the kind of that path, and the kind decides how the
   * path is checked. A path that exists proves nothing: the file can hold the
   * words of a rule while the rule is gone.
   *
   * - `config` reads the named value of the file.
   * - `file` reads the shape of the file.
   * - `command` runs the command.
   * - `document` reads the sections of the document.
   */
  async entryPointKinds(check) {
    const settings = { ...(config.agents ?? {}), ...check };
    const file = settings.file ?? "AGENTS.md";
    if (!existsSync(file)) return { ok: false, reason: `${file} is missing` };

    const content = readFileSync(file, "utf8");
    const lines = content.trimEnd().split("\n").length;
    if (settings.maxLines && lines > settings.maxLines) {
      return {
        ok: false,
        reason: `${file} has ${lines} lines, the limit is ${settings.maxLines}`,
      };
    }

    const rules = content
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim());

    if (rules.length === 0)
      return { ok: false, reason: `${file} names no rules` };

    const registry = settings.rules ?? {};
    const problems = [];

    for (const rule of rules) {
      const match = rule.match(/Enforced by:\s*(\S+)\s*$/);
      if (!match) {
        problems.push(
          `the rule "${rule}" names no enforcement path. The form is "${ENFORCEMENT_FORM}", where the kind is one of ${KINDS.join(", ")}.`,
        );
        continue;
      }

      const token = match[1];
      const separator = token.indexOf(":");
      const kind = separator === -1 ? "" : token.slice(0, separator);
      const target = separator === -1 ? token : token.slice(separator + 1);
      const entry = registry[target] ?? {};

      if (!kind) {
        problems.push(
          `the rule "${rule}" names no kind. The form is "${ENFORCEMENT_FORM}", where the kind is one of ${KINDS.join(", ")}.`,
        );
        continue;
      }
      if (!target) {
        problems.push(
          `the rule "${rule}" names no path. The form is "${ENFORCEMENT_FORM}", where the kind is one of ${KINDS.join(", ")}.`,
        );
        continue;
      }
      if (!KINDS.includes(kind)) {
        problems.push(
          `the rule "${rule}" names the unknown kind ${kind}, the kinds are ${KINDS.join(", ")}`,
        );
        continue;
      }
      if (entry.kind && entry.kind !== kind) {
        problems.push(
          `the rule "${rule}" names the kind ${kind}, the registry names ${entry.kind} for ${target}`,
        );
        continue;
      }

      const reason = await validateKind(kind, target, entry);
      if (reason) problems.push(`the rule "${rule}": ${reason}`);
    }

    if (problems.length > 0) {
      return {
        ok: false,
        reason: `${file} has ${problems.length} broken rules`,
        detail: problems.join("\n"),
      };
    }

    if (settings.entryPoint) {
      if (!existsSync(settings.entryPoint)) {
        return { ok: false, reason: `${settings.entryPoint} is missing` };
      }
      const pointer = readFileSync(settings.entryPoint, "utf8").trim();
      if (pointer !== `@${file}`) {
        return {
          ok: false,
          reason: `${settings.entryPoint} must contain only @${file}, it contains: ${pointer}`,
        };
      }
    }

    return { ok: true };
  },

  /**
   * Asserts the built artifact holds what the sources imply. The build
   * command runs first, so a stale artifact cannot pass the check.
   */
  async artifactContains(check) {
    if (check.build) {
      if (isNoopCommand(check.build)) {
        return {
          ok: false,
          reason: `the criterion proves nothing: \`${check.build.trim()}\` exits 0 without building anything`,
        };
      }
      const built = await run(check.build);
      if (built.code !== 0) {
        return {
          ok: false,
          reason: `the build command \`${expand(check.build)}\` exited ${built.code}`,
          detail: tail(built.output, 10),
        };
      }
    }

    if (!existsSync(check.artifact)) {
      return {
        ok: false,
        reason: `${check.artifact} is missing, the build did not produce it`,
      };
    }

    const content = readFileSync(check.artifact, "utf8");
    const missing = (check.contains ?? []).filter(
      (needle) => !content.includes(needle),
    );
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `${check.artifact} does not hold: ${missing.join(", ")}`,
      };
    }
    return { ok: true };
  },

  /**
   * Compares a set of names against a set the harness holds. The set lives in
   * this file, so editing the config alone cannot weaken the gate. A missing
   * member, a renamed member and a duplicated member all fail.
   */
  async exactSet(check) {
    const set = BUILTIN_SETS[check.set];
    if (!set) {
      return {
        ok: false,
        reason: `the set ${check.set} is not one the harness holds: ${Object.keys(BUILTIN_SETS).join(", ")}`,
      };
    }

    const members = membersOf(check.set);
    if (members === null) {
      return { ok: false, reason: `the set ${check.set} holds no members` };
    }

    const counts = new Map();
    for (const member of members)
      counts.set(member, (counts.get(member) ?? 0) + 1);

    const missing = set.filter((member) => !counts.has(member));
    const unexpected = members.filter((member) => !set.includes(member));
    const duplicated = [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([member]) => member);

    const problems = [];
    if (missing.length > 0) problems.push(`missing: ${missing.join(", ")}`);
    if (unexpected.length > 0)
      problems.push(`not one the harness holds: ${unexpected.join(", ")}`);
    if (duplicated.length > 0)
      problems.push(`duplicated: ${duplicated.join(", ")}`);

    if (problems.length > 0) {
      return {
        ok: false,
        reason: `the ${check.set} set does not hold what the harness holds`,
        detail: problems.join("\n"),
      };
    }

    if (check.run) {
      const result = await run(check.run);
      if (result.code !== 0) {
        return {
          ok: false,
          reason: `\`${expand(check.run)}\` exited ${result.code}`,
          detail: tail(result.output, 20),
        };
      }
    }

    return { ok: true };
  },

  /**
   * The old name of the entry point check. It reads the same rules with the
   * same parser and the same message, so a repository that still names the
   * check `agentsFile` gets the same gate.
   */
  agentsFile(check) {
    return checks.entryPointKinds(check);
  },

  actorParams(check) {
    const settings = { ...(config.dataAccess ?? {}), ...check };
    if (!settings.dir)
      return { ok: false, reason: "dataAccess.dir is not set" };
    if (!existsSync(settings.dir))
      return { ok: false, reason: `${settings.dir} is missing` };

    const actor = new RegExp(
      settings.actorPattern ?? "\\b(userId|ownerId|viewerId|actorId)\\b",
    );
    const allowlist = readAllowlist(settings.allowlist);
    const problems = [];

    const files = walk(settings.dir).filter(
      (file) =>
        file.endsWith(".ts") &&
        !file.includes(".test.ts") &&
        !file.includes(".spec.ts"),
    );

    const exported = new Map();
    for (const file of files) {
      for (const fn of exportedFunctions(readFileSync(file, "utf8"))) {
        exported.set(fn.name, fn);
        if (actor.test(fn.params)) continue;
        if (allowlist.has(fn.name)) continue;
        problems.push(
          `${fn.name} in ${file} takes no actor id and is not on the allowlist`,
        );
      }
    }

    for (const name of allowlist.keys()) {
      if (!exported.has(name)) {
        problems.push(
          `${name} is on the allowlist but is not an exported function in ${settings.dir}`,
        );
      }
    }

    if (problems.length > 0) {
      return {
        ok: false,
        reason: `${problems.length} data functions break the actor rule`,
        detail: problems.join("\n"),
      };
    }
    return { ok: true };
  },
};

const KINDS = ["config", "file", "command", "document"];

/**
 * The form a rule of the entry point file uses to name its enforcement. The
 * kind and the path are one token, so there is no space after the colon.
 */
const ENFORCEMENT_FORM = "Enforced by: <kind>:<path>";

/**
 * The sets the harness holds. A set lives in this file, so the config alone
 * cannot change it.
 */
const BUILTIN_SETS = {
  criteria: EXPECTED_CRITERION_IDS,
  proofs: EXPECTED_PROOF_NAMES,
};

function membersOf(set) {
  if (set === "criteria") {
    return criteria.map(
      (criterion) => criterion.id ?? criterion.check?.type ?? "criterion",
    );
  }
  if (set === "proofs") {
    return (config.proofs ?? []).map((proof) => proof.name);
  }
  return null;
}

function mkdirFor(target) {
  const directory = path.dirname(target);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
}

function normalizeTitle(title) {
  return String(title)
    .replace(/^\s*#{1,6}\s*/, "")
    .replace(/\s*#+\s*$/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/[*_`]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * The titles of a markdown document: its headings and its bolded titles. A
 * word in a paragraph is not a title.
 */
function documentTitles(content) {
  const titles = [];
  for (const line of content.split("\n")) {
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.*\S)\s*$/);
    if (heading) {
      titles.push(heading[1]);
      continue;
    }
    const bold = line.match(/^\s*\*\*(.+?)\*\*\s*:?\s*$/);
    if (bold) titles.push(bold[1]);
  }
  return titles;
}

function splitRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function findGuardrailColumn(header, configured) {
  if (typeof configured === "number") return configured;
  const index = header.findIndex((cell) => /guardrail/i.test(cell));
  return index;
}

/**
 * True when a token in a table cell names a file. A rule name such as
 * `local/no-cross-layer-import` is not a file, and a command such as
 * `pnpm install` is not a file.
 */
function looksLikePath(token) {
  if (token.includes(" ")) return false;
  if (/^\.{0,2}\//.test(token)) return true;
  return /\.[A-Za-z0-9]+$/.test(token);
}

/**
 * True when a step runs the required command.
 */
function stepRuns(entry, required) {
  return stepDoesNotRun(entry, required) === null;
}

/**
 * The reason a step does not run the required command, or null when it does.
 */
function stepDoesNotRun(entry, required) {
  const guard = entry.siblings?.if;
  if (guard === false || guard === "false") {
    return "the step is guarded by `if: false`";
  }

  const lines = commandLines(entry.value);
  if (lines.length === 0) {
    return "the run value holds no command, it only prints or comments one";
  }

  const reasons = [];
  for (const line of lines) {
    if (swallowsFailure(line)) {
      reasons.push(`the command \`${line}\` swallows its own failure`);
      continue;
    }
    const effective = stripPackageManager(line);
    if (runsCommand(effective, required)) return null;
    reasons.push(`the run value runs \`${effective}\`, not \`${required}\``);
  }

  return reasons[0] ?? "the run value runs another command";
}

/**
 * Validates one enforcement path by the kind it names. The path existing is
 * never enough.
 */
async function validateKind(kind, target, entry) {
  const full = path.join(root, target);

  if (kind === "command") {
    const command = entry.run ?? target;
    if (isNoopCommand(command)) {
      return `the command \`${command}\` proves nothing`;
    }
    const result = await run(command);
    if (result.code !== 0) {
      return `the command \`${expand(command)}\` exited ${result.code}`;
    }
    return null;
  }

  if (!existsSync(full)) return `${target} does not exist`;

  if (kind === "config") {
    const content = readFileSync(full, "utf8");
    const missing = (entry.contains ?? []).filter(
      (needle) => !content.includes(needle),
    );
    if (missing.length > 0) {
      return `${target} does not hold: ${missing.join(", ")}`;
    }
    if (target.endsWith(".json")) {
      try {
        JSON.parse(content);
      } catch (error) {
        return `${target} is not valid JSON: ${error.message}`;
      }
    }
    if (target.endsWith(".yml") || target.endsWith(".yaml")) {
      const yaml = loadYaml();
      if (!yaml)
        return "the yaml package is missing, add it to the dev dependencies";
      try {
        yaml.parse(content);
      } catch (error) {
        return `${target} is not valid YAML: ${error.message}`;
      }
    }
    return null;
  }

  if (kind === "document") {
    const content = readFileSync(full, "utf8");
    const titles = documentTitles(content);
    if (titles.length === 0) return `${target} holds no section`;
    for (const section of entry.sections ?? []) {
      const wanted = normalizeTitle(section);
      const found = titles.some((title) => {
        const normalized = normalizeTitle(title);
        return normalized === wanted || normalized.includes(wanted);
      });
      if (!found) {
        return `${target} holds no section titled ${section}`;
      }
    }
    return null;
  }

  // kind === "file"
  const content = readFileSync(full, "utf8");
  const bodyLines = content.trimEnd().split("\n").length;
  const minimum = entry.minLines ?? 1;
  if (bodyLines < minimum) {
    return `${target} holds ${bodyLines} lines, at least ${minimum} are required`;
  }
  const missing = (entry.contains ?? []).filter(
    (needle) => !content.includes(needle),
  );
  if (missing.length > 0) {
    return `${target} does not hold: ${missing.join(", ")}`;
  }
  return null;
}

let passed = 0;
let failed = 0;

const selected = only
  ? criteria.filter(
      (criterion) => (criterion.id ?? criterion.check?.type) === only,
    )
  : criteria;

const GATE_NAMES = ["coverage", "proof-set"];

if (only && selected.length === 0 && !GATE_NAMES.includes(only))
  die(`no criterion is named ${only}`);

const startedAt = process.hrtime.bigint();

for (const criterion of selected) {
  const check = criterion.check ?? {};
  const handler = checks[check.type];
  const label = criterion.id ?? check.type ?? "criterion";

  if (!handler) {
    console.log(`FAIL  ${label}  unknown check type: ${check.type}`);
    failed += 1;
    continue;
  }

  let result;
  try {
    result = await handler(check);
  } catch (error) {
    result = { ok: false, reason: error.message };
  }

  if (result.ok) {
    console.log(`PASS  ${label}  ${criterion.why ?? ""}`.trimEnd());
    if (result.note) console.log(`      note: ${result.note}`);
    passed += 1;
    continue;
  }

  console.log(`FAIL  ${label}  ${criterion.why ?? ""}`.trimEnd());
  console.log(`      ${result.reason}`);
  if (result.detail) {
    for (const line of String(result.detail).split("\n"))
      console.log(`      ${line}`);
  }
  failed += 1;
}

/**
 * The criteria list is a set, not a count. A criterion that is deleted,
 * renamed or duplicated fails the score, and the floor in the config must
 * match the set the harness holds, so that lowering the floor does not make a
 * broken score look green.
 */
const ids = criteria.map(
  (criterion) => criterion.id ?? criterion.check?.type ?? "criterion",
);
const counts = new Map();
for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

const missing = EXPECTED_CRITERION_IDS.filter((id) => !counts.has(id));
const unexpected = ids.filter((id) => !EXPECTED_CRITERION_IDS.includes(id));
const duplicated = [...counts.entries()]
  .filter(([, count]) => count > 1)
  .map(([id]) => id);

const minimum = config.minimumCriteria ?? EXPECTED_CRITERION_IDS.length;
const coverage = [];
if (missing.length > 0)
  coverage.push(`the criteria ${missing.join(", ")} are missing`);
if (unexpected.length > 0)
  coverage.push(
    `the criteria ${unexpected.join(", ")} are not one the harness holds`,
  );
if (duplicated.length > 0)
  coverage.push(`the criteria ${duplicated.join(", ")} appear more than once`);
if (minimum !== EXPECTED_CRITERION_IDS.length) {
  coverage.push(
    `minimumCriteria is ${minimum}, the harness holds ${EXPECTED_CRITERION_IDS.length} criteria`,
  );
}
if (criteria.length !== EXPECTED_CRITERION_IDS.length) {
  coverage.push(
    `the harness scores ${criteria.length} criteria, the harness holds ${EXPECTED_CRITERION_IDS.length}`,
  );
}

if (coverage.length > 0) {
  console.log("FAIL  coverage  the harness scores the criteria it must hold");
  for (const problem of coverage) console.log(`      ${problem}`);
  failed += 1;
} else {
  console.log(`PASS  coverage  the harness scores ${criteria.length} criteria`);
  passed += 1;
}

/**
 * The scorer and the prover must hold the same proof set, or one of them
 * holds a gate the other does not.
 */
if (!only) {
  const proverPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "prove-guardrails.mjs",
  );
  if (!existsSync(proverPath)) {
    console.log("FAIL  proof-set  the prover is missing");
    console.log("      scripts/prove-guardrails.mjs must hold the proof set");
    failed += 1;
  } else {
    const proverSource = readFileSync(proverPath, "utf8");
    const drift = EXPECTED_PROOF_NAMES.filter(
      (name) => !proverSource.includes(`"${name}"`),
    );
    if (drift.length > 0) {
      console.log("FAIL  proof-set  the scorer and the prover disagree");
      console.log(
        `      the prover does not hold: ${drift.join(", ")}. Both files must hold the same proof set.`,
      );
      failed += 1;
    } else {
      console.log(
        `PASS  proof-set  the scorer and the prover hold the same set`,
      );
      passed += 1;
    }
  }
}

const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
const ceiling = config.maxHarnessSeconds ?? 300;
console.log(
  `harness: ${seconds.toFixed(1)}s runtime, the ceiling is ${ceiling}s`,
);
if (seconds > ceiling) {
  console.log(
    `FAIL  runtime  the harness took ${seconds.toFixed(1)}s, the ceiling is ${ceiling}s`,
  );
  failed += 1;
}

if (Array.isArray(config.notes) && config.notes.length > 0 && !only) {
  console.log("\nharness notes:");
  for (const note of config.notes) console.log(`  - ${note}`);
}

console.log(`\nharness: ${passed} passed, ${failed} failed`);

if (failed > 0) process.exit(1);
