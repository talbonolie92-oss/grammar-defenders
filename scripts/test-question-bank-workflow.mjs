import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../teacher-dashboard.html", import.meta.url), "utf8");
const dashboard = await readFile(new URL("../src/dashboard.js", import.meta.url), "utf8");
const parser = await readFile(new URL("../src/docx-question-parser.js", import.meta.url), "utf8");
const css = await readFile(new URL("../css/dashboard.css", import.meta.url), "utf8");
const battle = await readFile(new URL("../src/scenes/BattleScene.js", import.meta.url), "utf8");
const main = await readFile(new URL("../src/main.js", import.meta.url), "utf8");

// Manual entry supports A–C plus an optional D, and exposes all four correct-answer choices.
for (const id of ["bank-q", "bank-a1", "bank-a2", "bank-a3", "bank-a4", "bank-correct"]) {
  assert.ok(html.includes('id="' + id + '"'), "Missing manual question control: " + id);
}
assert.match(html, /Answer D \(optional\)/, "Fourth manual choice should be clearly optional.");
for (const value of [0, 1, 2, 3]) {
  assert.ok(html.includes('<option value="' + value + '">' + "ABCD"[value] + "</option>"), "Missing correct-answer option " + "ABCD"[value]);
}
assert.match(dashboard, /a:\[\$\("bank-a1"\)\.value,\$\("bank-a2"\)\.value,\$\("bank-a3"\)\.value,\$\("bank-a4"\)\.value\]/, "Manual submission must pass all four choices.");
assert.ok(dashboard.includes("mammoth.convertToHtml("), "DOCX extraction must preserve manual line breaks through HTML conversion.");
assert.ok(dashboard.includes("if(importingDocx)return;"), "Repeated clicks must not start overlapping DOCX imports.");
assert.ok(dashboard.includes("finally{importingDocx=false;$(\"docx-extract\").disabled=false;}"), "DOCX upload control must always recover after success or failure.");
assert.ok(dashboard.includes("if(!teacher||savingBank)return;"), "Repeated clicks must not create duplicate question banks.");
assert.ok(dashboard.includes("finally{savingBank=false;$(\"bank-save\").disabled=false;}"), "Save control must always recover after success or failure.");
assert.ok(dashboard.includes(String.raw`.replace(/<br\s*\/?\s*>/gi,"\n")`), "DOCX HTML br elements must become parser-visible newlines.");
assert.ok(dashboard.includes('docx-question-parser.js?v=docx-break-fix-1'), "Parser module URL must be cache-busted with the DOCX fix.");
assert.match(dashboard, /const importedQuestions=parsed\.questions\.map/, "DOCX parser output must be normalized into the draft question shape.");
assert.match(dashboard, /bankDraft\.push\(\.\.\.importedQuestions\)/, "DOCX questions should flow directly into the shared draft.");
assert.match(dashboard, /bank-draft-preview"\)\.children\.length!==bankDraft\.length/, "DOCX import must verify that every draft question was rendered.");
assert.ok(html.indexOf('id="bank-draft-area"') < html.indexOf('id="manual-question-form"'), "Imported question review must appear before the optional manual-entry form.");
assert.match(dashboard, /preview\.innerHTML=bankDraft\.length\?/, "Draft review must render an explicit empty state and imported question cards.");
assert.match(dashboard, /\$\("bank-draft-area"\)\.scrollIntoView/, "After DOCX import, scroll directly to the imported question review area.");
assert.match(dashboard, /q\.correct===null[\s\S]*?mark its correct answer before saving/, "Saving must require teacher approval of each imported answer.");
assert.match(dashboard, /data-draft-answer/, "Imported choices must be editable in the review cards.");
assert.match(dashboard, /data-draft-field="correct"/, "Imported correct answers must be teacher-selectable.");
assert.match(parser, /correct: null/, "DOCX parser must not guess correct answers.");
assert.match(dashboard, /a\.length>4/, "Question normalization must reject more than four choices.");
assert.match(css, /\.bank-answer-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, "Manual choices should use a balanced two-column layout.");

assert.ok(html.includes('id="session-bank"'), "Session creation must expose a saved question-set selector.");
assert.ok(html.includes('id="session-bank-status"'), "The session selector must explain available saved topics.");
assert.ok(html.includes("Saved question sets"), "The dashboard must clearly label the saved question bank list.");
assert.ok(dashboard.includes('Other / mixed grade'), "Saved banks outside the current grade groups must remain visible rather than disappearing.");
assert.ok(dashboard.includes('questionBankId:bank?.id||""') && dashboard.includes('questionCount:bank?.questions?.length||0'), "New sessions must record the selected question bank and its question count.");
assert.ok(dashboard.includes("updateSessionBankStatus") && dashboard.includes("regular and boss challenges"), "The selected topic and its gameplay scope must be explicit in the session form.");
assert.ok(dashboard.includes('if(bank)data.questions=bank.questions.map'), "The selected saved question set must be copied into the session payload.");
assert.ok(dashboard.includes('normalizeBankQuestion({...q,grade,topic},subject,topic)'), "Every imported question must display the saved topic selected by the teacher.");
assert.ok(dashboard.includes('s.questionCount?s.questionCount+" questions":""'), "Session details must show how many saved questions were loaded.");
assert.ok(main.includes('questions: Array.isArray(studentSession.questions) ? studentSession.questions : []'), "Student launch must pass the session questions into gameplay.");
assert.ok(battle.includes('this.customQuestions.length ? this.customQuestions : BOSS_QUESTIONS'), "Boss challenges must use selected lesson questions when a custom bank is active.");
assert.ok(css.includes(".session-topic-picker{") && css.includes(".saved-bank-section{"), "Topic selector and saved question list must be visually prominent.");

console.log("Question-bank workflow tests passed: manual A–D entry, DOCX draft handoff, teacher answer review, and four-choice validation.");
