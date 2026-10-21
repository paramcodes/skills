#!/usr/bin/env node
/**
 * Proves the guardrails bite.
 *
 * Each case writes a file that breaks one rule, runs the checker that owns
 * that rule, and asserts the checker failed with the expected message. Every
 * probe file is restored or removed afterwards, on every exit path: a normal
 * run, a thrown error, an interrupt, a termination. A violation that is not
 * caught fails the script.
 *
 * A case may also require the checker to pass (`exit: "zero"`). Those cases
 * prove that a guardrail still holds, for example that a legitimate import is
 * not flagged.
 *
 * Only one run may own a tree at a time. The run takes an exclusive lock
 * before it touches the tree, so two overlapping runs cannot fight over the
 * same probe files, and the run that waits never leaves a probe behind.
 *
 * The script never passes while proving nothing. The proof set must hold the
 * exact cases the harness holds, a case that is deleted, renamed or
 * duplicated fails the run, and `minimumProofs` must match that set. The set
 * lives in this file and the floor lives in `harness.config.json`, so editing
 * the config alone cannot weaken the gate.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const root = path.resolve(process.argv[2] ?? scriptRoot);
process.chdir(root);

const configPath = process.env.HARNESS_CONFIG ?? "harness.config.json";

if (!existsSync(configPath)) {
  console.error(`prove: ${configPath} is missing`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch (error) {
  console.error(`prove: ${configPath} is not valid JSON: ${error.message}`);
  process.exit(1);
}

const packageManager = config.packageManager ?? "pnpm";
const execCommand = config.commands?.exec ?? `${packageManager} exec`;
const alias = config.layers?.data?.alias ?? "@/db";
const proofs = Array.isArray(config.proofs) ? config.proofs : [];
const criteria = Array.isArray(config.criteria) ? config.criteria : [];
const minimumProofs = config.minimumProofs;

/**
 * The proof cases the harness holds.
 *
 * The list lives in this file, not only in `harness.config.json`, so that
 * editing the config alone cannot weaken the gate: a proof case that is
 * deleted, renamed or duplicated fails the run.
 *
 * `scripts/harness-score.mjs` holds the same list, and the scorer proves the
 * two files agree.
 *
 * Adding a proof case is allowed. It is a deliberate act of editing this
 * list, of raising `minimumProofs` in the config, and of editing the list in
 * the scorer in the same commit.
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
  "the arch lint ignores the built output",
  "the mistake log criterion fails when a row names no guardrail",
  "the mistake log criterion fails when a row names a guardrail that does not exist",
  "the entry point criterion fails when a rule names no kind",
  "the scorer restores its probe when it is killed with a signal",
  "the scorer repairs a tree that a killed run left dirty",
  "the command criterion fails when the command only prints",
  "the harness fails when a package script only prints",
  "the entry point criterion fails when a rule names an unregistered path",
  "the ci criterion fails when a step is allowed to fail",
];

if (!Number.isInteger(minimumProofs) || minimumProofs < 1) {
  console.error(
    `prove: ${configPath} must set minimumProofs to a whole number of at least 1`,
  );
  process.exit(1);
}

if (minimumProofs !== EXPECTED_PROOF_NAMES.length) {
  console.error(
    `prove: minimumProofs is ${minimumProofs}, the harness holds ${EXPECTED_PROOF_NAMES.length} proof cases`,
  );
  process.exit(1);
}

const names = proofs.map((proof) => proof.name);
const nameCounts = new Map();
for (const name of names) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);

const missingNames = EXPECTED_PROOF_NAMES.filter(
  (name) => !nameCounts.has(name),
);
const unexpectedNames = names.filter(
  (name) => !EXPECTED_PROOF_NAMES.includes(name),
);
const duplicatedNames = [...nameCounts.entries()]
  .filter(([, count]) => count > 1)
  .map(([name]) => name);

if (
  missingNames.length > 0 ||
  unexpectedNames.length > 0 ||
  duplicatedNames.length > 0
) {
  console.error(
    "prove: the proof set does not hold the cases the harness holds",
  );
  if (missingNames.length > 0)
    console.error(`  missing: ${missingNames.join(", ")}`);
  if (unexpectedNames.length > 0)
    console.error(`  unexpected: ${unexpectedNames.join(", ")}`);
  if (duplicatedNames.length > 0)
    console.error(`  duplicated: ${duplicatedNames.join(", ")}`);
  process.exit(1);
}

if (proofs.length === 0) {
  console.error("prove: the proof set is empty, so nothing is proved");
  process.exit(1);
}

if (proofs.length < minimumProofs) {
  console.error(
    `prove: the proof set holds ${proofs.length} cases, at least ${minimumProofs} are required`,
  );
  process.exit(1);
}

/**
 * Every proof case names the criterion it breaks. A case that names nothing
 * proves nothing, and a case that names a criterion the harness does not
 * hold proves the wrong thing.
 */
const criterionIds = criteria.map(
  (criterion) => criterion.id ?? criterion.check?.type ?? "criterion",
);

// The gates of the scorer are not criteria, but a proof case may name one of
// them, because a gate is a thing that can fail.
const gateIds = ["coverage", "proof-set", "runtime"];
const unnamed = proofs.filter((proof) => !proof.criterion);
if (unnamed.length > 0) {
  console.error("prove: every proof case must name the criterion it breaks");
  for (const proof of unnamed)
    console.error(`  ${proof.name} names no criterion`);
  process.exit(1);
}
const unknownCriterion = proofs.filter(
  (proof) =>
    !criterionIds.includes(proof.criterion) &&
    !gateIds.includes(proof.criterion),
);
if (unknownCriterion.length > 0) {
  console.error(
    "prove: a proof case names a criterion the harness does not hold",
  );
  for (const proof of unknownCriterion)
    console.error(`  ${proof.name} names ${proof.criterion}`);
  process.exit(1);
}

function expand(text, probe) {
  return String(text)
    .replaceAll("${PM}", packageManager)
    .replaceAll("${PM_EXEC}", execCommand)
    .replaceAll("${DATA_ALIAS}", alias)
    .replaceAll("${PROOF_COUNT}", String(EXPECTED_PROOF_NAMES.length))
    .replaceAll("${PROBE}", probe ?? "");
}

/**
 * The checker runs in a child process without blocking the event loop. A
 * blocking call would swallow the interrupt that stops this script, which is
 * the one signal the operator can always send.
 */
let runningChild = null;

function run(command, probe) {
  return new Promise((resolve) => {
    const child = spawn(expand(command, probe), {
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

function directoriesFor(file) {
  const missing = [];
  let current = path.dirname(path.join(root, file));
  while (current.startsWith(root) && !existsSync(current)) {
    missing.push(current);
    current = path.dirname(current);
  }
  return missing.reverse();
}

/**
 * The journal holds the state of the files the runner is about to overwrite.
 * It lives outside the tree, so a run that is killed outright still leaves a
 * record that the next run restores.
 */
const journalPath = path.join(
  os.tmpdir(),
  `harness-prove-journal-${createHash("sha256").update(root).digest("hex").slice(0, 12)}.json`,
);

/**
 * The lock of the run.
 *
 * Two runs of the prover on one tree fight over the same probe files and the
 * same journal, and the loser leaves a probe behind in the tree, which then
 * fails the format check. The lock makes the tree the resource of one run:
 * the second run waits for the first to finish and refuses when the wait
 * runs out.
 *
 * The lock lives outside the tree, so a run that was killed outright cannot
 * leave it in the repository. A lock whose owner is gone is broken, so a
 * killed run never blocks the next one.
 *
 * The path may be set with `PROVE_LOCK_PATH`, so a proof case can hold the
 * lock of a tree on purpose. A run uses one lock per tree.
 */
const lockPath = resolveLockPath();

function resolveLockPath() {
  const override = process.env.PROVE_LOCK_PATH;
  if (!override) {
    return path.join(
      os.tmpdir(),
      `harness-prove-lock-${createHash("sha256").update(root).digest("hex").slice(0, 12)}.lock`,
    );
  }
  return path.isAbsolute(override) ? override : path.join(root, override);
}

/** The milliseconds a run waits for the lock before it refuses to run. */
const lockWaitMs = Number(process.env.PROVE_LOCK_WAIT_MS ?? 120_000);

/** The milliseconds after which a lock without a readable owner is stale. */
const lockStaleMs = Number(process.env.PROVE_LOCK_STALE_MS ?? 60_000);

/** Sleeps without blocking the event loop for longer than it has to. */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * True when the lock belongs to a process that is gone.
 *
 * A run that was killed outright leaves its lock behind. The lock of a live
 * process is never broken, and a lock that cannot be read is only broken
 * when it is older than every run can take.
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
 *
 * The lock is created with the exclusive flag, so exactly one run can hold
 * it. A second run waits for the first to finish. A lock whose owner is gone
 * is broken by renaming it, which only one run can win, so two runs can never
 * break the same lock and enter the tree together.
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
 * Releases the lock of the run.
 *
 * Only the owner releases the lock, so a run that lost the lock to a broken
 * stale lock never removes the lock of the run that holds it now.
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
let pendingDirectories = new Set();
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
 * Restores every file the runner touched and removes every directory it made.
 * It is safe to call twice, and it is called on every exit path.
 */
function restoreTree() {
  for (const entry of [...pendingFiles].reverse()) {
    try {
      if (entry.existed) writeFileSync(entry.path, entry.content);
      else rmSync(entry.path, { force: true });
    } catch (error) {
      console.error(`prove: could not restore ${entry.path}: ${error.message}`);
    }
  }
  pendingFiles = [];

  for (const directory of [...pendingDirectories].reverse()) {
    rmSync(directory, { recursive: true, force: true });
  }
  pendingDirectories.clear();

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
        `prove: restored ${stale.pendingFiles.length} probe file(s) left behind by an earlier run`,
      );
    }
  } catch (error) {
    console.error(`prove: could not read the probe journal: ${error.message}`);
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
  console.error(`\nprove: ${signal} received, the tree was restored`);
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
    `prove: another run holds the lock of this tree and did not finish within ${lockWaitMs} ms`,
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

let caught = 0;
let missed = 0;

for (const proof of proofs) {
  const writes = proof.write ?? [];
  const probe = writes[0]?.path ?? "";

  try {
    for (const write of writes) {
      const target = path.join(root, write.path);
      const existed = existsSync(target);
      pendingFiles.push({
        path: target,
        existed,
        content: existed ? readFileSync(target, "utf8") : "",
      });
      for (const directory of directoriesFor(write.path)) {
        mkdirSync(directory, { recursive: true });
        pendingDirectories.add(directory);
      }
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, expand(write.content, write.path));
    }
    writeJournal();

    const expectation = proof.expect ?? {};
    const result = await run(expectation.run, probe);
    const expectedExit = expectation.exit ?? "nonzero";

    if (expectedExit !== "nonzero" && expectedExit !== "zero") {
      console.log(
        `FAIL ${proof.name}: the expectation names an unknown exit: ${expectedExit}`,
      );
      missed += 1;
      continue;
    }
    if (expectedExit === "nonzero" && result.code === 0) {
      console.log(
        `FAIL ${proof.name}: the checker exited 0, so the violation was not caught`,
      );
      missed += 1;
      continue;
    }
    if (expectedExit === "zero" && result.code !== 0) {
      console.log(
        `FAIL ${proof.name}: the checker exited ${result.code}, it was expected to pass\n${result.output}`,
      );
      missed += 1;
      continue;
    }
    if (expectation.contains && !result.output.includes(expectation.contains)) {
      console.log(
        `FAIL ${proof.name}: expected ${expectation.contains} in the output, got:\n${result.output}`,
      );
      missed += 1;
      continue;
    }

    const detail =
      expectedExit === "zero"
        ? "the guardrail still holds"
        : `caught by ${expectation.contains ?? "the checker"}`;
    console.log(`PASS ${proof.name}: ${detail}`);
    caught += 1;
  } finally {
    restoreTree();
  }
}

console.log(`\nprove: ${caught} caught, ${missed} missed`);

if (missed > 0) process.exit(1);

if (caught < minimumProofs) {
  console.error(
    `prove: only ${caught} proofs ran, at least ${minimumProofs} must run`,
  );
  process.exit(1);
}
