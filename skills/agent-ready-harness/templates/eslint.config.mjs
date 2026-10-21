import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import arch from "./eslint.arch.mjs";
import { rules as localRules } from "./eslint-rules/index.mjs";

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
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: {
      local: { rules: localRules },
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
