import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import arch from "./eslint.arch.mjs";

/**
 * The lint configuration.
 *
 * `eslint.arch.mjs` holds the boundary rule and registers the local plugin,
 * so this file and the arch command run the same rule on the same layers.
 * A plugin may not be registered twice in one configuration, so the local
 * rules are used through the plugin the arch configuration registers.
 */

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  ...tseslint.configs.recommended,
  arch,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    linterOptions: {
      noInlineConfig: true,
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "local/no-raw-json-parse": "error",
      "local/no-inline-config": "error",
      "no-console": ["error", { allow: ["error", "warn"] }],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": true,
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    rules: {
      "local/no-skipped-tests": "error",
    },
  },
]);
