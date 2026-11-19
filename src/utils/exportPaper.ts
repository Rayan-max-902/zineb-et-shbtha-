import type { AppState } from "../types";
import { computeLineDiff, formatSystemInstruction } from "./diff";

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function buildMarkdownPaper(state: AppState): string {
  const v1Full = formatSystemInstruction(state.v1);
  const v2Full = formatSystemInstruction(state.v2);
  const diffLines = computeLineDiff(v1Full, v2Full);

  const diffFormatted = diffLines
    .map((line) => {
      if (line.type === "added") return `+ ${line.text}`;
      if (line.type === "removed") return `- ${line.text}`;
      return `  ${line.text}`;
    })
    .join("\n");

  const verificationRows = state.testCases
    .map((row, idx) => {
      const inputCell = row.anonymizedText.replace(/\|/g, "\\|").replace(/\n/g, " ");
      const outputCell = (row.v2Output || row.v1Output || "Not yet run")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ");
      const checkCell = (row.expectedCheck || "Pending check")
        .replace(/\|/g, "\\|")
        .replace(/\n/g, " ");
      const errType = row.v2Output ? row.v2ErrorType : row.v1ErrorType;
      const correction = (row.v2Output ? row.v2Correction : row.v1Correction) || "—";
      const tag = row.isTricky ? " [Tricky]" : "";
      return `| ${idx + 1}. ${row.label}${tag} | ${inputCell} | ${outputCell} | ${checkCell} | ${errType} | ${correction.replace(/\|/g, "\\|").replace(/\n/g, " ")} |`;
    })
    .join("\n");

  const processEntries =
    state.processLog.length > 0
      ? state.processLog
          .map(
            (entry, i) =>
              `### Run ${i + 1}: ${entry.version} — ${entry.testCaseLabel}\n- Timestamp: ${entry.timestamp}\n- Model: ${entry.model} (${entry.latencyMs} ms)\n- Input Sent:\n\`\`\`\n${entry.inputSent}\n\`\`\`\n- Output Received:\n\`\`\`\n${entry.outputReceived}\n\`\`\``
          )
          .join("\n\n")
      : "_No live runs recorded yet. Run inputs against Version 1 and Version 2 in the Prompt Lab or Verification Log to populate reproducible execution logs._";

  const reflectionText = [
    "### How Would This Work Have Differed Without AI?",
    state.reflection.withoutAi.trim() || "_Not yet drafted._",
    "",
    "### For Which Tasks Would You Not Trust the Assistant, and Why?",
    state.reflection.untrustedTasks.trim() || "_Not yet drafted._",
    "",
    "### Ethical and Methodological Risks in This Discipline",
    state.reflection.ethicalMethodological.trim() || "_Not yet drafted._",
  ].join("\n\n");

  const totalReflectionWords = countWords(
    `${state.reflection.withoutAi} ${state.reflection.untrustedTasks} ${state.reflection.ethicalMethodological}`
  );

  return [
    `# ${state.meta.projectTitle}`,
    `**Author:** ${state.meta.studentName || "Student Author"} | **Course:** ${state.meta.courseName || "AI Assistant Evaluation Project"}`,
    "",
    `## Task Definition & Pre-Test Labeling Rules`,
    `- **Task Summary:** ${state.meta.taskSummary}`,
    `- **Output Format:** ${state.meta.outputSchemaSummary}`,
    `- **Input Source:** ${state.meta.dataSourceNote}`,
    "",
    `### Labeling Rules (Defined Before Testing)`,
    state.meta.labelingRules,
    "",
    `---`,
    "",
    `## 1. Instruction Text (Version 1 & Version 2 with Highlighted Differences)`,
    "",
    `### Version 1 Instructions`,
    "```text",
    v1Full,
    "```",
    "",
    `### Version 2 Instructions`,
    state.v2.rationale ? `**Revision Rationale:** ${state.v2.rationale}\n` : "",
    "```text",
    v2Full,
    "```",
    "",
    `### Highlighted Differences (Version 1 -> Version 2)`,
    "```diff",
    diffFormatted,
    "```",
    "",
    `---`,
    "",
    `## 2. Verification Log`,
    "",
    `| Test Case | Anonymized Input | Assistant Output | Independent Check | Error Type | Correction / Rule Applied |`,
    `| :--- | :--- | :--- | :--- | :--- | :--- |`,
    verificationRows,
    "",
    `---`,
    "",
    `## 3. Prompt & Process Record (Reproducibility Log)`,
    "",
    processEntries,
    "",
    `---`,
    "",
    `## 4. Reflection (${totalReflectionWords} words)`,
    "",
    reflectionText,
  ].join("\n");
}
