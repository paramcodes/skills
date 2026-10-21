import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import { rules as localRules } from "./eslint-rules/index.mjs";

/**
 * The boundary configuration.
 *
 * The layers live in `harness.config.json`, and the rule that holds them
 * lives in `eslint-rules/index.mjs`. `eslint.config.mjs` includes this
 * configuration, so the arch command and the lint command read the same
 * layers and run the same rule. They cannot disagree.
 *
 * The rule decides for itself which files it applies to. A file that owns no
 * layer is never flagged, so a file outside the layers cannot block a change.
 */

export default defineConfig([
  // The ignore list covers what the harness builds. The default config
  // builds into dist, so a lint that scans the built output lints the
  // compiler's output and fails on it.
  globalIgnores([
    "node_modules/**",
    "dist/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module",
    },
    plugins: {
      local: { rules: localRules },
    },
    rules: {
      "local/no-cross-layer-import": "error",
    },
  },
]);
