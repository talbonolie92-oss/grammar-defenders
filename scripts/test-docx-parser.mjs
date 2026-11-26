import assert from "node:assert/strict";
import { parseDocxQuestions } from "../src/docx-question-parser.js";
const fixtures = [
  { name:"numbered questions, choices on separate lines", text:"1. What is customer service?\nA. Selling products\nB. Helping customers\nC. Making advertisements\nD. Managing money\n\n2. What does defective mean?\nA. Working properly\nB. Very expensive\nC. Damaged or faulty\nD. Newly purchased", count:2 },
  { name:"unnumbered questions, parenthesized labels", text:"What is a noun?\n(A) A person, place, or thing\n(B) An action\n(C) A description", count:1 },
  { name:"question and choices in one paragraph", text:"Which word is a verb? A. quickly B. jump C. blue D. table", count:1 },
  { name:"choices separated by tabs", text:"Choose the correct article:\tA. a\tB. an\tC. the", count:1 },
  { name:"choice label and answer on separate lines", text:"What is an adjective?\nA.\nA word that describes a noun\nB.\nA word that names an action", count:1 },
  { name:"mixed punctuation styles", text:"Select the correct sentence.\nA) She go to school.\nB: She goes to school.\nC - She going school.", count:1 },
  { name:"question wraps before choices", text:"Which sentence uses the present simple tense?\nChoose the best answer.\nA. I am eating now.\nB. She walks to school.\nC. They were playing.", count:1 }
];
for (const f of fixtures) {
  const result = parseDocxQuestions(f.text, {grade:"Grade 11",topic:"Parser test"});
  assert.equal(result.questions.length, f.count, f.name + "; unparsed=" + result.unparsed.join("; "));
  assert.ok(result.questions.every(q=>q.correct===null && q.grade==="Grade 11" && q.topic==="Parser test"), f.name + " should preserve metadata.");
}
const bad=parseDocxQuestions("Question without choices");
assert.equal(bad.questions.length,0);
assert.ok(bad.unparsed.length>0,"Unrecognized content must be reported.");
console.log("DOCX parser tests passed: "+fixtures.length+" layout fixtures plus incomplete-content reporting.");