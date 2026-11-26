export function parseDocxQuestions(source, options = {}) {
  const grade = options.grade || "Grade 10";
  const topic = options.topic || "";
  const normalized = String(source ?? "").replace(/\r\n?/g, "\n").replace(/[\u00a0\u2007\u202f]/g, " ").replace(/\t+/g, " ").replace(/[ ]{2,}/g, " ");
  const lines = normalized.split("\n").map(line => line.trim()).filter(Boolean);
  const questions = [], unparsed = [];
  let current = null, pendingLetter = null;
  const cleanQuestion = value => String(value ?? "").replace(/^\s*(?:(?:question|q)\s*)?\d+\s*[.)\]:-]\s*/i, "").replace(/^\s*[-•*]\s*/, "").trim();
  const markerSource = "(?:\\(([A-D])\\)|([A-D])\\s*[.)：:]|([A-D])\\s+-)";
  const inlineRegex = new RegExp("(?:^|\\s)" + markerSource + "\\s+", "gi");
  const choiceLineRegex = /^\s*(?:\(([A-D])\)|([A-D])\s*[.)：:]|([A-D])\s+-)\s*(.*?)\s*$/i;
  const standaloneRegex = /^\s*(?:\(([A-D])\)|([A-D])\s*[.)：:]|([A-D])\s+-)\s*$/i;
  const addChoice = (letter, value, original) => {
    const index = letter.charCodeAt(0) - 65, text = String(value ?? "").trim();
    if (!current) { unparsed.push("Choice has no question: " + original); return; }
    if (index < 0 || index > 3) { unparsed.push("Unsupported choice label: " + original); return; }
    if (!text) { pendingLetter = letter; return; }
    if (current.choices[index]) { unparsed.push("Duplicate " + letter + " choice: " + original); return; }
    current.choices[index] = text; pendingLetter = null;
  };
  const finish = () => {
    if (!current) return;
    const last = current.choices.reduce((found, value, index) => value ? index : found, -1);
    const choices = last < 0 ? [] : current.choices.slice(0, last + 1);
    if (current.q.trim() && choices.length >= 2 && choices.every(Boolean)) {
      questions.push({ q: current.q.trim(), a: choices, correct: null, grade, topic, effect: "GRAMMAR POWER!" });
    } else unparsed.push("Incomplete question: " + [current.q, ...choices].filter(Boolean).join(" | "));
    current = null; pendingLetter = null;
  };
  const startQuestion = q => { current = { q: cleanQuestion(q), choices: [null, null, null, null] }; };
  for (const raw of lines) {
    const line = raw.replace(/^\s*[-•*]\s*/, "").trim();
    if (!line) continue;
    if (pendingLetter) { addChoice(pendingLetter, line, line); continue; }
    const matches = [...line.matchAll(new RegExp(inlineRegex.source, inlineRegex.flags))];
    if (matches.length >= 2) {
      const first = matches[0], prefix = line.slice(0, first.index + (first[0].startsWith(" ") ? 1 : 0)).trim();
      if (prefix) {
        if (current?.choices.some(Boolean)) finish();
        if (!current) startQuestion(prefix); else current.q += " " + cleanQuestion(prefix);
      }
      if (!current) { unparsed.push("Choices have no question: " + line); continue; }
      matches.forEach((match, index) => {
        const letter = (match[1] || match[2] || match[3]).toUpperCase();
        const textStart = match.index + match[0].length, next = matches[index + 1];
        const textEnd = next ? next.index + (next[0].startsWith(" ") ? 1 : 0) : line.length;
        addChoice(letter, line.slice(textStart, textEnd).trim(), line);
      });
      continue;
    }
    const standalone = line.match(standaloneRegex);
    if (standalone) {
      if (!current) { unparsed.push("Choice label has no question: " + line); continue; }
      addChoice((standalone[1] || standalone[2] || standalone[3]).toUpperCase(), "", line);
      continue;
    }
    const choice = line.match(choiceLineRegex);
    if (choice) {
      if (!current) { unparsed.push("Choice has no question: " + line); continue; }
      addChoice((choice[1] || choice[2] || choice[3]).toUpperCase(), choice[4], line);
      continue;
    }
    if (!current) startQuestion(line);
    else if (current.choices.some(Boolean)) { finish(); startQuestion(line); }
    else current.q += " " + line;
  }
  finish();
  return { questions, unparsed };
}