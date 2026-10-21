/**
 * Local ESLint rules for this repository.
 *
 * These are the checks ESLint core cannot express: a JSON payload must reach
 * a schema before it is trusted, a test may not be skipped or focused, no
 * file may carry its own lint configuration, and a layer may not reach across
 * a boundary it does not own.
 *
 * The boundary rule is shared by `eslint.arch.mjs` and `eslint.config.mjs`, so
 * the arch command and the lint command cannot disagree about what a boundary
 * is. Both read the layer list from `harness.config.json`.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA_PARSE_METHODS = new Set([
  "parse",
  "safeParse",
  "parseAsync",
  "safeParseAsync",
]);

const TEST_CALL_NAMES = new Set(["it", "test", "describe", "suite", "bench"]);

const DISABLED_TEST_CALLS = new Set(["xit", "xtest", "xdescribe", "xbench"]);

const DISABLED_TEST_METHODS = new Set(["skip", "only", "todo"]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The layers of this repository.
 *
 * The list comes from `harness.config.json`, so the rule and the harness can
 * never disagree about where a layer lives. A repository without a config
 * holds no layers, and the rule never fires.
 */
function readLayers() {
  let config;
  try {
    config = JSON.parse(
      readFileSync(path.join(root, "harness.config.json"), "utf8"),
    );
  } catch {
    return { data: {}, layers: [], order: [] };
  }

  const data = config.layers?.data ?? {};
  const layers = config.layers?.restricted ?? [];
  const order =
    Array.isArray(config.layers?.order) && config.layers.order.length > 0
      ? config.layers.order
      : layers.map((layer) => layer.name);

  return {
    data: {
      alias: data.alias ?? "@/db",
      dir: data.dir ?? "src/db",
    },
    layers,
    order,
  };
}

const { data: dataLayer, layers, order } = readLayers();

/**
 * Turns a glob into a regular expression. The globs hold `**` for a whole
 * directory and `*` for one segment.
 */
function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped
    .replace(/\*\*\//g, "\u0000")
    .replace(/\*\*/g, "\u0001")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, "(?:.*/)?")
    .replace(/\u0001/g, ".*");
  return new RegExp(`^${pattern}$`);
}

const layerMatchers = layers.map((layer) => ({
  name: layer.name,
  dir: layer.dir ?? "",
  matchers: (layer.files ?? []).map(globToRegExp),
}));

/** The layer a file of the repository belongs to, or null when it owns none. */
function layerOfFile(relativePath) {
  for (const layer of layerMatchers) {
    if (layer.matchers.some((matcher) => matcher.test(relativePath))) {
      return layer;
    }
  }
  return null;
}

/** The layer a path points at, by the directory it lives in. */
function layerOfPath(relativePath) {
  for (const layer of layerMatchers) {
    if (layer.dir && relativePath.startsWith(`${layer.dir}/`)) return layer;
  }
  return null;
}

function isDataPath(relativePath) {
  return (
    relativePath === dataLayer.dir ||
    relativePath.startsWith(`${dataLayer.dir}/`)
  );
}

/**
 * The repository path an import points at, or null when the import names
 * something this repository does not own.
 */
function resolveImport(source, importer) {
  if (source === dataLayer.alias || source.startsWith(`${dataLayer.alias}/`)) {
    const rest = source.slice(dataLayer.alias.length).replace(/^\//, "");
    return rest === "" ? dataLayer.dir : `${dataLayer.dir}/${rest}`;
  }
  if (!source.startsWith(".")) return null;
  return path.posix.normalize(
    path.posix.join(path.posix.dirname(importer), source),
  );
}

function isJsonParseCall(node) {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "MemberExpression" &&
    !node.callee.computed &&
    node.callee.object.type === "Identifier" &&
    node.callee.object.name === "JSON" &&
    node.callee.property.name === "parse"
  );
}

function isSchemaParseCall(node) {
  if (!node || node.type !== "CallExpression") return false;
  if (node.callee.type !== "MemberExpression" || node.callee.computed)
    return false;
  return SCHEMA_PARSE_METHODS.has(node.callee.property.name);
}

function rootCalleeName(node) {
  let current = node;
  while (
    current.type === "MemberExpression" ||
    current.type === "CallExpression"
  ) {
    current =
      current.type === "MemberExpression" ? current.object : current.callee;
  }
  return current.type === "Identifier" ? current.name : null;
}

const noRawJsonParse = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require untrusted JSON to be parsed through a schema before use.",
    },
    schema: [],
    messages: {
      rawJsonParse:
        "Parse this JSON through a schema. Hand the result to a schema parse call instead of using it raw.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isJsonParseCall(node)) return;
        if (isSchemaParseCall(node.parent)) return;
        context.report({ node, messageId: "rawJsonParse" });
      },
    };
  },
};

const noSkippedTests = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow skipped, focused and todo tests.",
    },
    schema: [],
    messages: {
      skippedTest:
        "This test is skipped, focused or unfinished. Finish it and delete the marker before committing.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Identifier") {
          if (DISABLED_TEST_CALLS.has(node.callee.name)) {
            context.report({ node, messageId: "skippedTest" });
          }
          return;
        }

        if (node.callee.type !== "MemberExpression" || node.callee.computed)
          return;
        if (!DISABLED_TEST_METHODS.has(node.callee.property.name)) return;

        const root = rootCalleeName(node.callee);
        if (root && TEST_CALL_NAMES.has(root)) {
          context.report({ node, messageId: "skippedTest" });
        }
      },
    };
  },
};

const noInlineConfig = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow inline ESLint configuration.",
    },
    schema: [],
    messages: {
      inlineConfig:
        "Inline ESLint configuration is not allowed. Fix the code or change the shared rule in eslint.config.mjs.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      Program() {
        const directives =
          typeof sourceCode.getInlineConfigNodes === "function"
            ? sourceCode.getInlineConfigNodes()
            : sourceCode
                .getAllComments()
                .filter((comment) => /^\s*eslint\b/.test(comment.value));

        for (const comment of directives) {
          context.report({ node: comment, messageId: "inlineConfig" });
        }
      },
    };
  },
};

/**
 * A layer may reach the layers below it and never the layers above it. The
 * data layer is off limits to every layer but itself.
 *
 * A file that owns no layer is never flagged, so a file outside the layers
 * cannot block a change.
 */
const noCrossLayerImport = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow an import that crosses a layer boundary.",
    },
    schema: [],
    messages: {
      dataLayer:
        "The data layer is off limits here. Read it through the action or route layer that owns the session.",
      crossLayer:
        "This layer must not reach a layer above it. Move the shared code down a layer instead.",
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const relative = path.relative(root, filename).split(path.sep).join("/");

    if (relative === "" || relative.startsWith("..")) return {};

    const importer = layerOfFile(relative);
    if (!importer) return {};

    const importerIndex = order.indexOf(importer.name);

    function check(node, source) {
      if (typeof source !== "string") return;
      const resolved = resolveImport(source, relative);
      if (resolved === null) return;

      if (isDataPath(resolved)) {
        if (layers.some((layer) => layer.name === importer.name)) {
          context.report({ node, messageId: "dataLayer" });
        }
        return;
      }

      const target = layerOfPath(resolved);
      if (!target) return;

      const targetIndex = order.indexOf(target.name);
      if (targetIndex === -1 || importerIndex === -1) return;
      if (targetIndex < importerIndex) {
        context.report({ node, messageId: "crossLayer" });
      }
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node, node.source.value);
      },
      ExportAllDeclaration(node) {
        if (node.source) check(node, node.source.value);
      },
      CallExpression(node) {
        if (node.callee.type !== "Import") return;
        const [argument] = node.arguments;
        if (!argument || argument.type !== "Literal") return;
        check(node, argument.value);
      },
    };
  },
};

export const rules = {
  "no-raw-json-parse": noRawJsonParse,
  "no-skipped-tests": noSkippedTests,
  "no-inline-config": noInlineConfig,
  "no-cross-layer-import": noCrossLayerImport,
};
