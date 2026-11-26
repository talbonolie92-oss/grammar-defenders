import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../teacher-dashboard.html", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/dashboard.js", import.meta.url), "utf8");
const parser = await readFile(new URL("../src/docx-question-parser.js", import.meta.url), "utf8");
const css = await readFile(new URL("../css/dashboard.css", import.meta.url), "utf8");

// Manual entry supports A–C plus an optional D, and exposes all four correct-answer choices.
for (const id of ["bank-q", "bank-a1", "bank-a2", "bank-a3", "bank-a4", "bank-correct"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing manual question control: " + id);
}
assert.match(html, /Answer D \(optional\)/, "Fourth manual choice should be clearly optional.");
for (const value of [0, 1, 2, 3]) {
  assert.ok(html.includes('<option value="' + value + '">' + "ABCD"[value] + "</option>"), "Missing correct-answer option " + "ABCD"[value]);
}
assert.match(dashboard, /a:\[\$\("bank-a1"\)\.value,\$\("bank-a2"\)\.value,\$\("bank-a3"\)\.value,\$\("bank-a4"\)\.value\]/, "Manual submission must pass all four choices.");
assert.match(dashboard, /bankDraft\.push\(\.\.\.parsed\.questions\)/, "DOCX questions should flow directly into the shared draft.");
assert.ok(html.indexOf('id="bank-draft-area"') < html.indexOf('id="manual-question-form"'), "Imported question review must appear before the optional manual-entry form.");
assert.match(dashboard, /preview\.innerHTML=bankDraft\.length\?/, "Draft review must render an explicit empty state and imported question cards.");
assert.match(dashboard, /\$\("bank-draft-area"\)\.scrollIntoView/, "After DOCX import, scroll directly to the imported question review area.");
assert.match(dashboard, /q\.correct===null[\s\S]*?mark its correct answer before saving/, "Saving must require teacher approval of each imported answer.");
assert.match(dashboard, /data-draft-answer/, "Imported choices must be editable in the review cards.");
assert.match(dashboard, /data-draft-field="correct"/, "Imported correct answers must be teacher-selectable.");
assert.match(parser, /correct: null/, "DOCX parser must not guess correct answers.");
assert.match(dashboard, /a\.length>4/, "Question normalization must reject more than four choices.");
assert.match(css, /\.bank-answer-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, "Manual choices should use a balanced two-column layout.");

console.log("Question-bank workflow tests passed: manual A–D entry, DOCX draft handoff, teacher answer review, and four-choice validation.");
