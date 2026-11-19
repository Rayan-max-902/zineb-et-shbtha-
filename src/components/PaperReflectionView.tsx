import { Download, Printer } from "lucide-react";
import type { AppState, ReflectionSections } from "../types";
import { computeLineDiff, formatSystemInstruction } from "../utils/diff";
import { buildMarkdownPaper, countWords } from "../utils/exportPaper";

interface PaperReflectionViewProps {
  state: AppState;
  onUpdateReflection: (patch: Partial<ReflectionSections>) => void;
}

export function PaperReflectionView({
  state,
  onUpdateReflection,
}: PaperReflectionViewProps) {
  const { reflection, meta, v1, v2, testCases, processLog } = state;

  const w1 = countWords(reflection.withoutAi);
  const w2 = countWords(reflection.untrustedTasks);
  const w3 = countWords(reflection.ethicalMethodological);
  const totalWords = w1 + w2 + w3;

  const wordStatus =
    totalWords < 500
      ? `Under target (${500 - totalWords} words to reach 500)`
      : totalWords <= 700
        ? "Within 500–700 word target"
        : `Over target (${totalWords - 700} words above 700)`;

  const wordStatusClass =
    totalWords >= 500 && totalWords <= 700
      ? "text-emerald-700"
      : totalWords > 700
        ? "text-amber-700"
        : "text-slate-600";

  const v1Full = formatSystemInstruction(v1);
  const v2Full = formatSystemInstruction(v2);
  const diffLines = computeLineDiff(v1Full, v2Full);

  function handleDownloadMarkdown() {
    const md = buildMarkdownPaper(state);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meta.presetId || "ai-assistant"}-project-paper.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadJson() {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meta.presetId || "ai-assistant"}-audit-archive.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="no-print flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-medium text-slate-500">
            04. Written Paper Assembly &amp; Reflection · 500–700 Word Target
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Draft your reflection and export the complete submission paper
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Combines your V1/V2 instructions, highlighted diff, verification log table, reproducible prompt logs, and 500–700 word reflection into one printable document.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Save JSON Backup
          </button>
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Download Markdown
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Reflection Editor (Hidden on print) */}
      <section className="no-print rounded-xl border border-slate-200 bg-white p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Guided Reflection Editor
            </h2>
            <p className="text-xs text-slate-500">
              Answer all three syllabus reflection questions directly below.
            </p>
          </div>

          <div className="text-right">
            <p className="font-mono text-lg font-semibold text-slate-900 tabular-nums">
              {totalWords} / 500–700 words
            </p>
            <p className={`text-xs font-medium tabular-nums ${wordStatusClass}`}>
              {wordStatus}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-900">
                1. How would this work have differed without AI?
              </label>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {w1}w
              </span>
            </div>
            <textarea
              rows={8}
              value={reflection.withoutAi}
              onChange={(e) =>
                onUpdateReflection({ withoutAi: e.target.value })
              }
              placeholder="Compare manual processing (spreadsheets, regex, human reading) against designing, debugging, and verifying the assistant..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-900">
                2. For which tasks would you not trust the assistant, and why?
              </label>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {w2}w
              </span>
            </div>
            <textarea
              rows={8}
              value={reflection.untrustedTasks}
              onChange={(e) =>
                onUpdateReflection({ untrustedTasks: e.target.value })
              }
              placeholder="Cite concrete failures from your Verification Log (e.g., ambiguous merchants, unstated sample sizes, relative dates)..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-900">
                3. Ethical or methodological risks in your discipline
              </label>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {w3}w
              </span>
            </div>
            <textarea
              rows={8}
              value={reflection.ethicalMethodological}
              onChange={(e) =>
                onUpdateReflection({ ethicalMethodological: e.target.value })
              }
              placeholder="Discuss silent error propagation, overconfidence in structured outputs, privacy/data leakage, and verification labor..."
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>
      </section>

      {/* Printable Written Paper Preview */}
      <article className="print-only-paper mx-auto max-w-4xl rounded-xl border border-slate-200 bg-white p-8 sm:p-12 space-y-8">
        <header className="border-b border-slate-200 pb-6 space-y-2">
          <p className="text-xs font-medium text-slate-500">
            {meta.courseName || "Individual Project"} · Written Submission Preview
          </p>
          <h2 className="text-2xl font-bold text-slate-900">
            {meta.projectTitle}
          </h2>
          <p className="text-sm text-slate-600">
            Author: {meta.studentName || "Student Author (set in Task & Rules)"}
          </p>
          <div className="pt-2 text-xs text-slate-600 space-y-1">
            <p>
              <strong className="text-slate-900">Task Scope:</strong>{" "}
              {meta.taskSummary}
            </p>
            <p>
              <strong className="text-slate-900">Output Format:</strong>{" "}
              <span className="font-mono">{meta.outputSchemaSummary}</span>
            </p>
            <p>
              <strong className="text-slate-900">Pre-Test Labeling Rules:</strong>{" "}
              {meta.labelingRules}
            </p>
          </div>
        </header>

        {/* Section 1: Instructions & Diff */}
        <section className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900">
            1. Instruction Text (Version 1 &amp; Version 2)
          </h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-slate-900">Version 1</p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed">
                {v1Full}
              </pre>
            </div>
            <div className="rounded-lg border border-slate-200 p-4 space-y-1.5">
              <p className="text-xs font-semibold text-slate-900">Version 2</p>
              <pre className="whitespace-pre-wrap font-mono text-xs text-slate-700 leading-relaxed">
                {v2Full}
              </pre>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 border-b border-slate-200">
              Highlighted Differences (V1 to V2)
            </div>
            <div className="font-mono text-xs divide-y divide-slate-100">
              {diffLines.map((line, i) => (
                <div
                  key={i}
                  className={`px-4 py-1 whitespace-pre-wrap ${
                    line.type === "added"
                      ? "bg-emerald-50 text-emerald-950"
                      : line.type === "removed"
                        ? "bg-red-50 text-red-950"
                        : "text-slate-600"
                  }`}
                >
                  {line.type === "added"
                    ? `+ ${line.text}`
                    : line.type === "removed"
                      ? `- ${line.text}`
                      : `  ${line.text}`}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: Verification Log Table */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-slate-900">
            2. Verification Log
          </h3>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                  <th className="p-2.5 font-semibold">Input</th>
                  <th className="p-2.5 font-semibold">V1 / V2 Output</th>
                  <th className="p-2.5 font-semibold">Your Check</th>
                  <th className="p-2.5 font-semibold">Error Type</th>
                  <th className="p-2.5 font-semibold">Correction</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {testCases.map((tc, i) => (
                  <tr key={tc.id} className="align-top">
                    <td className="p-2.5">
                      <div className="font-semibold text-slate-900">
                        {i + 1}. {tc.label} {tc.isTricky ? "(Tricky)" : ""}
                      </div>
                      <div className="font-mono text-slate-600 mt-0.5">
                        {tc.anonymizedText}
                      </div>
                    </td>
                    <td className="p-2.5 font-mono text-slate-700">
                      {tc.v1Output && (
                        <div>
                          <span className="font-semibold">V1:</span> {tc.v1Output}
                        </div>
                      )}
                      {tc.v2Output && (
                        <div className="mt-1">
                          <span className="font-semibold">V2:</span> {tc.v2Output}
                        </div>
                      )}
                      {!tc.v1Output && !tc.v2Output && "Pending run"}
                    </td>
                    <td className="p-2.5 text-slate-700">
                      {tc.expectedCheck || "—"}
                    </td>
                    <td className="p-2.5 text-slate-700">
                      <div>V1: {tc.v1ErrorType}</div>
                      <div>V2: {tc.v2ErrorType}</div>
                    </td>
                    <td className="p-2.5 text-slate-700">
                      {tc.v2Correction || tc.v1Correction || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Prompt & Process Record */}
        <section className="space-y-3">
          <h3 className="text-lg font-bold text-slate-900">
            3. Prompt &amp; Process Record ({processLog.length} logged runs)
          </h3>
          {processLog.length === 0 ? (
            <p className="text-xs text-slate-500">
              No live model runs have been recorded yet. Execute tests in Prompt Lab or Verification Log to populate reproducible timestamps and outputs.
            </p>
          ) : (
            <div className="space-y-3">
              {processLog.slice(0, 12).map((entry, idx) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-slate-200 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-600 font-mono">
                    <span className="font-semibold text-slate-900">
                      Run {idx + 1}: {entry.version} — {entry.testCaseLabel}
                    </span>
                    <span className="tabular-nums">
                      {entry.timestamp} · {entry.latencyMs}ms
                    </span>
                  </div>
                  <div className="font-mono text-slate-700">
                    Input: {entry.inputSent}
                  </div>
                  <div className="font-mono text-slate-900">
                    Output: {entry.outputReceived}
                  </div>
                </div>
              ))}
              {processLog.length > 12 && (
                <p className="text-xs text-slate-500">
                  + {processLog.length - 12} additional runs included in Markdown export.
                </p>
              )}
            </div>
          )}
        </section>

        {/* Section 4: Reflection */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-bold text-slate-900">4. Reflection</h3>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {totalWords} words
            </span>
          </div>

          <div className="space-y-3 text-sm leading-relaxed text-slate-800">
            <div>
              <h4 className="font-semibold text-slate-900">
                How this work would have differed without AI
              </h4>
              <p className="mt-1 whitespace-pre-wrap">
                {reflection.withoutAi || "Not yet drafted."}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">
                Tasks where the assistant cannot be trusted
              </h4>
              <p className="mt-1 whitespace-pre-wrap">
                {reflection.untrustedTasks || "Not yet drafted."}
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-slate-900">
                Ethical and methodological risks in this discipline
              </h4>
              <p className="mt-1 whitespace-pre-wrap">
                {reflection.ethicalMethodological || "Not yet drafted."}
              </p>
            </div>
          </div>
        </section>
      </article>
    </div>
  );
}
