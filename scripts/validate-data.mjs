import { QUESTIONS, BOSS_QUESTIONS } from "../src/data/questions.js";

const errors = [];

function validateQuestions(list, groupName) {
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(groupName + " must be a non-empty array.");
    return;
  }
  list.forEach((question, index) => {
    const label = groupName + " " + (index + 1);
    if (!question.topic || typeof question.topic !== "string") errors.push(label + ": missing topic.");
    if (!question.q || typeof question.q !== "string") errors.push(label + ": missing question text.");
    if (!Array.isArray(question.a) || question.a.length !== 3) {
      errors.push(label + ": must have exactly three answer choices.");
    } else {
      if (question.a.some(answer => typeof answer !== "string" || !answer.trim())) errors.push(label + ": answer choices must be non-empty strings.");
      if (new Set(question.a.map(answer => answer.trim().toLowerCase())).size !== question.a.length) errors.push(label + ": answer choices must be unique.");
    }
    if (!Number.isInteger(question.correct) || question.correct < 0 || question.correct > 2) errors.push(label + ": correct must be an answer index from 0 to 2.");
    if (!question.effect || typeof question.effect !== "string") errors.push(label + ": missing battle effect.");
  });
}

validateQuestions(QUESTIONS, "Regular question");
validateQuestions(BOSS_QUESTIONS, "Boss question");

if (errors.length) {
  console.error("Question bank validation failed:");
  errors.forEach(error => console.error(" - " + error));
  process.exit(1);
}

console.log("Question bank valid: " + QUESTIONS.length + " regular questions and " + BOSS_QUESTIONS.length + " boss questions checked.");
