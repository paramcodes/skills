import { readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const config = JSON.parse(
  readFileSync(new URL("./harness.config.json", import.meta.url), "utf8"),
);

const data = config.layers?.data ?? {};
const alias = data.alias ?? "@/db";
const base = path.basename(data.dir ?? "src/db");

const message =
  "The data layer is off limits here. Read it through the action or route layer that owns the session.";

const importPatterns = [
  alias,
  `${alias}/*`,
  `**/${base}`,
  `**/${base}/*`,
  `../${base}/*`,
  `../../${base}/*`,
];

function boundary(files) {
  return {
    files,
    languageOptions: {
      parser: tseslint.parser,
      sourceType: "module",
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: alias, message }],
          patterns: [{ group: importPatterns, message }],
        },
      ],
    },
  };
}

const restricted = config.layers?.restricted ?? [];

export default defineConfig([
  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
  ...restricted.map((layer) => boundary(layer.files)),
]);
