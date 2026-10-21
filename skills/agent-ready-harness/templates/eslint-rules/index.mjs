/**
 * Local ESLint rules for this repository.
 *
 * These are the checks ESLint core cannot express: a JSON payload must reach
 * a schema before it is trusted, a test may not be skipped or focused, and no
 * file may carry its own lint configuration.
 */

const SCHEMA_PARSE_METHODS = new Set([
  "parse",
  "safeParse",
  "parseAsync",
  "safeParseAsync",
]);

const TEST_CALL_NAMES = new Set(["it", "test", "describe", "suite", "bench"]);

const DISABLED_TEST_CALLS = new Set(["xit", "xtest", "xdescribe", "xbench"]);

const DISABLED_TEST_METHODS = new Set(["skip", "only", "todo"]);

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

export const rules = {
  "no-raw-json-parse": noRawJsonParse,
  "no-skipped-tests": noSkippedTests,
  "no-inline-config": noInlineConfig,
};
