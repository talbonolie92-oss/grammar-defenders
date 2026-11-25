import { QUESTIONS } from "../src/data/questions.js";

const errors = [];
if (!Array.isArray(QUESTIONS) || QUESTIONS.length === 0) {
  errors.push("Question bank must be a non-empty array.");
} else {
  QUESTIONS.forEach((question, index) => {
    const label = "Question " + (index + 1);
    if (!question.topic || typeof question.topic !== "string") errors.push(label + ": missing topic.");
    if (!question.grade || typeof question.grade !== "string") errors.push(label + ": missing grade.");
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

if (errors.length) {
  console.error("Question bank validation failed:");
  errors.forEach(error => console.error(" - " + error));
  process.exit(1);
}

console.log("Question bank valid: " + QUESTIONS.length + " questions checked.");
