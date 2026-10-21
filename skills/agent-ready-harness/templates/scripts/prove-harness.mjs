#!/usr/bin/env node
/**
 * Proves the harness can fail.
 *
 * The harness is a set of checks. A set of checks that never fails is
 * decoration. This script copies the harness into a scratch tree, breaks the
 * copy seven ways, and asserts the scorer fails on every one of them.
 *
 * The copy is broken in the ways a real change breaks it:
 *
 * - a command criterion runs a command that exits 0 and proves nothing,
 * - a criterion is deleted and another is duplicated, so the count holds,
 * - the proof set is emptied,
 * - a proof case is renamed,
 * - the criteria floor is lowered,
 * - the proof floor is lowered,
 * - a criterion holds a check type the scorer does not know.
 *
 * Every mutation must make the scorer fail, and the failure must name the
 * thing that was broken. The script exits non-zero when a mutation passes.
 *
 * The tree of the run is never touched. The scratch tree holds a copy of the
 * harness, and the copy is what gets broken.
 */

import { execSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const root = path.resolve(process.argv[2] ?? scriptRoot);

const configPath = path.join(root, "harness.config.json");
const scorerPath = path.join(root, "scripts", "harness-score.mjs");
const proverPath = path.join(root, "scripts", "prove-guardrails.mjs");

for (const file of [configPath, scorerPath, proverPath]) {
  if (!existsSync(file)) {
    console.error(`prove-harness: ${file} is missing`);
    process.exit(1);
  }
}

/**
 * The mutations.
 *
 * Each one names the text the failure must hold. The text is what a reader
 * needs to know which break was caught, so a mutation that fails with an
 * unrelated message does not count as caught.
 */
const mutations = [
  {
    name: "a command criterion runs a no-op",
    criterion: "boundaries",
    expect: "exits 0 without checking anything",
    apply(config) {
      const criterion = config.criteria.find(
        (candidate) => candidate.check?.type === "command",
      );
      if (!criterion) throw new Error("the config holds no command criterion");
      criterion.check.run = "true";
      return `the criterion ${criterion.id} now runs true`;
    },
  },
  {
    name: "a criterion is deleted and another is duplicated",
    criterion: "boundaries",
    expect: "appear more than once",
    apply(config) {
      const deleted = config.criteria.pop();
      const duplicated = config.criteria[0];
      config.criteria.push(JSON.parse(JSON.stringify(duplicated)));
      return `${deleted.id} was deleted and ${duplicated.id} was duplicated`;
    },
  },
  {
    name: "the proof set is emptied",
    criterion: "proofs",
    expect: "proofs set",
    apply(config) {
      config.proofs = [];
      return "the proof set holds no case";
    },
  },
  {
    name: "a proof case is renamed",
    criterion: "proofs",
    expect: "not one the harness holds",
    apply(config) {
      const proof = config.proofs[0];
      proof.name = `${proof.name} (renamed)`;
      return `the proof ${proof.name} was renamed`;
    },
  },
  {
    name: "the criteria floor is lowered",
    criterion: "boundaries",
    expect: "minimumCriteria is",
    apply(config) {
      const before = config.minimumCriteria;
      config.minimumCriteria = Math.max(1, before - 5);
      return `the criteria floor went from ${before} to ${config.minimumCriteria}`;
    },
  },
  {
    name: "the proof floor is lowered",
    criterion: "proofs",
    expect: "minimumProofs is",
    apply(config) {
      const before = config.minimumProofs;
      config.minimumProofs = Math.max(1, before - 5);
      return `the proof floor went from ${before} to ${config.minimumProofs}`;
    },
  },
  {
    name: "a criterion holds an unknown check type",
    criterion: "boundaries",
    expect: "unknown check type",
    apply(config) {
      const criterion = config.criteria[0];
      criterion.check.type = "vibes";
      return `the criterion ${criterion.id} now holds the check type vibes`;
    },
  },
];

const scratch = mkdtempSync(path.join(tmpdir(), "harness-self-proof-"));
let failed = 0;
let treeCount = 0;

/**
 * Copies the harness into a scratch tree.
 *
 * The copy resolves the dependencies of the repository it came from, because
 * the scorer reads the YAML of a workflow file and the copy must be able to
 * load that parser. The dependency directory is linked into the tree, so the
 * copy holds the same packages as the repository without a second install.
 */
function copyHarness() {
  treeCount += 1;
  const tree = path.join(scratch, `tree-${treeCount}`);
  const scripts = path.join(tree, "scripts");
  mkdirSync(scripts, { recursive: true });
  copyFileSync(configPath, path.join(tree, "harness.config.json"));
  copyFileSync(scorerPath, path.join(scripts, "harness-score.mjs"));
  copyFileSync(proverPath, path.join(scripts, "prove-guardrails.mjs"));

  const dependencies = path.join(root, "node_modules");
  if (existsSync(dependencies)) {
    symlinkSync(dependencies, path.join(tree, "node_modules"), "dir");
  }

  return tree;
}

function score(tree, only) {
  const config = path.join(tree, "harness.config.json");
  const scope = only ? ` --only ${only}` : "";
  try {
    const stdout = execSync(
      `node ${path.join(tree, "scripts", "harness-score.mjs")} ${root}${scope}`,
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        cwd: root,
        env: { ...process.env, HARNESS_CONFIG: config },
      },
    );
    return { code: 0, output: stdout };
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim();
    return {
      code: typeof error.status === "number" ? error.status : 1,
      output,
    };
  }
}

/**
 * The baseline is the copy the mutations are compared against. It must be
 * green, or a mutation that fails proves nothing: the copy was already
 * broken.
 */
const baseline = score(copyHarness());
if (baseline.code !== 0) {
  console.error(
    `prove-harness: the unmutated copy scored with exit ${baseline.code}, so the mutations prove nothing`,
  );
  for (const line of baseline.output.split("\n").slice(0, 30))
    console.error(`  ${line}`);
  console.error(
    "prove-harness: fix the harness until it scores green, then run the self proof again",
  );
  rmSync(scratch, { recursive: true, force: true });
  process.exit(1);
}
console.log("prove-harness: the unmutated copy scored green");

for (const mutation of mutations) {
  const tree = copyHarness();
  const configFile = path.join(tree, "harness.config.json");
  const config = JSON.parse(readFileSync(configFile, "utf8"));
  let change;
  try {
    change = mutation.apply(config);
  } catch (error) {
    console.log(`FAIL ${mutation.name}: ${error.message}`);
    failed += 1;
    rmSync(tree, { recursive: true, force: true });
    continue;
  }
  writeFileSync(configFile, `${JSON.stringify(config, null, 2)}\n`);

  const result = score(tree, mutation.criterion);
  rmSync(tree, { recursive: true, force: true });

  if (result.code === 0) {
    console.log(
      `FAIL ${mutation.name}: the scorer still passed, so the harness cannot fail`,
    );
    failed += 1;
    continue;
  }
  if (!result.output.includes(mutation.expect)) {
    console.log(
      `FAIL ${mutation.name}: the scorer failed without naming ${mutation.expect}`,
    );
    for (const line of result.output.split("\n").slice(0, 20))
      console.log(`  ${line}`);
    failed += 1;
    continue;
  }
  if (baseline.output.includes(mutation.expect)) {
    console.log(
      `FAIL ${mutation.name}: the unmutated copy already held ${mutation.expect}, so the mutation proved nothing`,
    );
    failed += 1;
    continue;
  }

  console.log(`PASS ${mutation.name}: ${change}, and the scorer failed on it`);
}

rmSync(scratch, { recursive: true, force: true });

console.log(
  `\nprove-harness: ${mutations.length - failed} of ${mutations.length} mutations were caught`,
);

if (failed > 0) process.exit(1);
