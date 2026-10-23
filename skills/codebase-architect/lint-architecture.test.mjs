import { test } from "node:test";
import assert from "node:assert/strict";
import { auditFile, extractSpecifiers } from "./lint-architecture.mjs";

const root = "/proj";
const codes = (file, src) => auditFile(root, `${root}/${file}`, src).map((v) => v.code);

test("multi-line static import is detected", () => {
  const src = `import {\n  repo,\n} from "../boards/boards.repo";\n`;
  assert.deepEqual(codes("src/features/cards/a.ts", src), ["ARCH-03"]);
});
test("dynamic import() is detected", () => {
  const src = `export const load = () => import("../boards/boards.repo");\n`;
  assert.deepEqual(codes("src/features/cards/a.ts", src), ["ARCH-03"]);
});
test("require() is detected", () => {
  const src = `const r = require("../boards/boards.repo");\n`;
  assert.deepEqual(codes("src/features/cards/a.js", src), ["ARCH-03"]);
});
test("export ... from re-export is detected", () => {
  const src = `export { repo } from "../boards/boards.repo";\n`;
  assert.deepEqual(codes("src/features/cards/a.ts", src), ["ARCH-03"]);
});
test("allowed contract import passes", () => {
  const src = `import type { Board } from "../boards/boards.schema";\n`;
  assert.deepEqual(codes("src/features/cards/a.ts", src), []);
});
test("commented-out forbidden import is not flagged", () => {
  const src = `// import { repo } from "../boards/boards.repo";\n/* import x from "../boards/boards.repo" */\nexport const ok = 1;\n`;
  assert.deepEqual(codes("src/features/cards/a.ts", src), []);
});
test("URL with // in a string does not hide a real import", () => {
  const src = `const u = "http://example.com";\nimport { repo } from "../boards/boards.repo";\n`;
  assert.deepEqual(codes("src/features/cards/a.ts", src), ["ARCH-03"]);
});
test("UI import in a service layer is flagged", () => {
  const src = `import { Button } from "../../shared/ui/button.tsx";\n`;
  assert.deepEqual(codes("src/features/cards/cards.service.ts", src), ["ARCH-04"]);
});
test("database import outside repo is flagged, inside repo is allowed", () => {
  assert.deepEqual(codes("src/features/cards/cards.api.ts", `import { db } from "../../server/db/client";\n`), ["ARCH-05"]);
  assert.deepEqual(codes("src/features/cards/cards.repo.ts", `import { db } from "../../server/db/client";\n`), []);
});
test("barrel and generic filenames are flagged", () => {
  assert.deepEqual(codes("src/features/cards/index.ts", ""), ["ARCH-01"]);
  assert.deepEqual(codes("src/shared/utils.ts", ""), ["ARCH-02"]);
});
test("file over 400 lines is flagged, tests exempt", () => {
  const big = "x\n".repeat(450);
  assert.deepEqual(codes("src/shared/calc/a.calc.ts", big), ["SIZE-01"]);
  assert.deepEqual(codes("src/shared/calc/a.test.ts", big), []);
});
test("violation line numbers point at the import", () => {
  const src = `const a = 1;\n\nimport { repo } from "../boards/boards.repo";\n`;
  const [v] = auditFile(root, `${root}/src/features/cards/a.ts`, src);
  assert.equal(v.line, 3);
});
test("extractSpecifiers dedupes and reports first line", () => {
  const src = `import a from "x";\nimport b from "x";\n`;
  assert.deepEqual(extractSpecifiers(src), [{ spec: "x", line: 1 }]);
});
