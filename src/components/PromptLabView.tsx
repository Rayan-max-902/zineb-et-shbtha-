import { ArrowRight, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { AssistantVersion, ProcessLogEntry, TestCaseRow } from "../types";
import { runAssistantOnServer } from "../utils/api";
import { computeLineDiff, formatSystemInstruction } from "../utils/diff";
import { scanAndSanitizePii } from "../utils/privacy";

interface PromptLabViewProps {
  v1: AssistantVersion;
  v2: AssistantVersion;
  testCases: TestCaseRow[];
  onChangeV1: (patch: Partial<AssistantVersion>) => void;
  onChangeV2: (patch: Partial<AssistantVersion>) => void;
  onCopyV1ToV2: () => void;
  onRecordRun: (entry: ProcessLogEntry, testCaseId?: string, output?: string, latencyMs?: number) => void;
  onGoToVerification: () => void;
}

export function PromptLabView({
  v1,
  v2,
  testCases,
  onChangeV1,
  onChangeV2,
  onCopyV1ToV2,
  onRecordRun,
  onGoToVerification,
}: PromptLabViewProps) {
  const [selectedTestId, setSelectedTestId] = useState<string>(
    testCases[0]?.id ?? ""
  );
  const [customSandboxInput, setCustomSandboxInput] = useState<string>("");
  const [sandboxV1Out, setSandboxV1Out] = useState<string>("");
  const [sandboxV2Out, setSandboxV2Out] = useState<string>("");
  const [sandboxMeta, setSandboxMeta] = useState<{
    v1Ms?: number;
    v2Ms?: number;
  }>({});
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [diffFilter, setDiffFilter] = useState<"all" | "changes">("all");

  const v1Full = formatSystemInstruction(v1);
  const v2Full = formatSystemInstruction(v2);
  const diffLines = computeLineDiff(v1Full, v2Full);
  const addedCount = diffLines.filter((l) => l.type === "added").length;
  const removedCount = diffLines.filter((l) => l.type === "removed").length;
  const displayedDiff =
    diffFilter === "changes"
      ? diffLines.filter((l) => l.type !== "unchanged")
      : diffLines;

  const selectedCase = testCases.find((t) => t.id === selectedTestId);
  const effectiveInput =
    customSandboxInput.trim() || selectedCase?.anonymizedText || "";
  const piiScan = scanAndSanitizePii(effectiveInput);

  async function handleRunComparison(target: "V1" | "V2" | "BOTH") {
    if (!effectiveInput) return;
    setRunError(null);
    setIsRunning(true);

    const safeInput = piiScan.hasPii ? piiScan.sanitizedText : effectiveInput;
    const caseId = customSandboxInput.trim()
      ? "sandbox-custom"
      : selectedCase?.id ?? "sandbox";
    const caseLabel = customSandboxInput.trim()
      ? "Custom Sandbox Input"
      : selectedCase?.label ?? "Sandbox Input";

    try {
      if (target === "V1" || target === "BOTH") {
        const res1 = await runAssistantOnServer(v1Full, safeInput);
        setSandboxV1Out(res1.outputText);
        setSandboxMeta((prev) => ({ ...prev, v1Ms: res1.latencyMs }));
        onRecordRun(
          {
            id: `run-${Date.now()}-v1`,
            version: "V1",
            testCaseId: caseId,
            testCaseLabel: caseLabel,
            systemInstruction: v1Full,
            inputSent: safeInput,
            outputReceived: res1.outputText,
            model: res1.model,
            latencyMs: res1.latencyMs,
            timestamp: res1.timestamp,
          },
          customSandboxInput.trim() ? undefined : selectedCase?.id,
          res1.outputText,
          res1.latencyMs
        );
      }

      if (target === "V2" || target === "BOTH") {
        const res2 = await runAssistantOnServer(v2Full, safeInput);
        setSandboxV2Out(res2.outputText);
        setSandboxMeta((prev) => ({ ...prev, v2Ms: res2.latencyMs }));
        onRecordRun(
          {
            id: `run-${Date.now()}-v2`,
            version: "V2",
            testCaseId: caseId,
            testCaseLabel: caseLabel,
            systemInstruction: v2Full,
            inputSent: safeInput,
            outputReceived: res2.outputText,
            model: res2.model,
            latencyMs: res2.latencyMs,
            timestamp: res2.timestamp,
          },
          customSandboxInput.trim() ? undefined : selectedCase?.id,
          res2.outputText,
          res2.latencyMs
        );
      }
    } catch (err: unknown) {
      setRunError(
        err instanceof Error ? err.message : "Failed to execute assistant."
      );
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-medium text-slate-500">
            02. Instruction Design &amp; Iteration · Version 1 vs Version 2
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Author Version 1, document failures, and refine into Version 2
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Define Role, Task, Restrictions, and Output Format cleanly. Any edits below update the highlighted instruction diff required for your written paper.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onCopyV1ToV2}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Copy V1 into V2
          </button>
          <button
            type="button"
            onClick={onGoToVerification}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            Open Verification Log
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Side-by-Side Instruction Editors */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Version 1 */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Version 1 Instructions
              </h2>
              <p className="text-xs text-slate-500">
                Initial baseline prompt before edge-case testing
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {v1Full.length} chars
            </span>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Role
              </label>
              <textarea
                rows={2}
                value={v1.role}
                onChange={(e) => onChangeV1({ role: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Task
              </label>
              <textarea
                rows={2}
                value={v1.task}
                onChange={(e) => onChangeV1({ task: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Restrictions
              </label>
              <textarea
                rows={4}
                value={v1.restrictions}
                onChange={(e) => onChangeV1({ restrictions: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Output Format
              </label>
              <textarea
                rows={3}
                value={v1.outputFormat}
                onChange={(e) => onChangeV1({ outputFormat: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Version 2 */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Version 2 Instructions
              </h2>
              <p className="text-xs text-slate-500">
                Revised prompt addressing V1 verification errors
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              {v2Full.length} chars
            </span>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Role
              </label>
              <textarea
                rows={2}
                value={v2.role}
                onChange={(e) => onChangeV2({ role: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Task
              </label>
              <textarea
                rows={2}
                value={v2.task}
                onChange={(e) => onChangeV2({ task: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Restrictions
              </label>
              <textarea
                rows={4}
                value={v2.restrictions}
                onChange={(e) => onChangeV2({ restrictions: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Output Format
              </label>
              <textarea
                rows={3}
                value={v2.outputFormat}
                onChange={(e) => onChangeV2({ outputFormat: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Revision Rationale (Why V2 changed)
              </label>
              <textarea
                rows={2}
                value={v2.rationale ?? ""}
                onChange={(e) => onChangeV2({ rationale: e.target.value })}
                placeholder="Summarize which V1 errors motivated these changes..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Highlighted Instruction Diff Viewer */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Highlighted Instruction Diff (Version 1 to Version 2)
            </h2>
            <p className="text-xs text-slate-500 tabular-nums">
              +{addedCount} added lines · -{removedCount} removed lines
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setDiffFilter("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                diffFilter === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Full Diff
            </button>
            <button
              type="button"
              onClick={() => setDiffFilter("changes")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                diffFilter === "changes"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Changes Only
            </button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 font-mono text-xs">
          {displayedDiff.length === 0 ? (
            <div className="px-6 py-6 text-slate-500">
              Version 1 and Version 2 instructions are currently identical. Edit Version 2 above to highlight changes.
            </div>
          ) : (
            displayedDiff.map((line, index) => {
              const rowStyle =
                line.type === "added"
                  ? "bg-emerald-50/70 text-emerald-950"
                  : line.type === "removed"
                    ? "bg-red-50/70 text-red-950"
                    : "bg-white text-slate-700";
              const marker =
                line.type === "added"
                  ? "+"
                  : line.type === "removed"
                    ? "-"
                    : " ";

              return (
                <div
                  key={index}
                  className={`flex items-start gap-3 px-6 py-1.5 ${rowStyle}`}
                >
                  <span className="w-8 shrink-0 text-right text-slate-400 tabular-nums select-none">
                    {line.v1LineNo ?? ""}
                  </span>
                  <span className="w-8 shrink-0 text-right text-slate-400 tabular-nums select-none">
                    {line.v2LineNo ?? ""}
                  </span>
                  <span className="w-3 shrink-0 font-semibold select-none">
                    {marker}
                  </span>
                  <span className="whitespace-pre-wrap break-words flex-1">
                    {line.text || " "}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Side-by-Side Live Test Bench */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Live Side-by-Side Comparison Sandbox
            </h2>
            <p className="text-xs text-slate-500">
              Runs both Version 1 and Version 2 through Gemini on a single input and records the result to your reproducibility log.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isRunning || !effectiveInput}
              onClick={() => handleRunComparison("V1")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Run V1
            </button>
            <button
              type="button"
              disabled={isRunning || !effectiveInput}
              onClick={() => handleRunComparison("V2")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              Run V2
            </button>
            <button
              type="button"
              disabled={isRunning || !effectiveInput}
              onClick={() => handleRunComparison("BOTH")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              {isRunning ? "Running..." : "Run V1 & V2"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="lg:col-span-5 space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Select from Test Corpus
            </label>
            <select
              value={selectedTestId}
              onChange={(e) => {
                setSelectedTestId(e.target.value);
                setCustomSandboxInput("");
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            >
              {testCases.map((tc, i) => (
                <option key={tc.id} value={tc.id}>
                  {i + 1}. {tc.label} {tc.isTricky ? "(Tricky)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-7 space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Or Override with Custom Test Input (automatically PII-scrubbed before sending)
            </label>
            <input
              type="text"
              value={customSandboxInput}
              onChange={(e) => setCustomSandboxInput(e.target.value)}
              placeholder={selectedCase?.anonymizedText ?? "Paste anonymized test text..."}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        {piiScan.hasPii && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-xs text-amber-900">
            Privacy guard detected {piiScan.detections.length} sensitive token(s) ({piiScan.detections.map((d) => d.type).join(", ")}) and will automatically substitute redacted placeholders before calling the API.
          </div>
        )}

        {runError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            {runError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">
                Version 1 Output
              </span>
              <span className="font-mono text-slate-500 tabular-nums">
                {sandboxMeta.v1Ms !== undefined ? `${sandboxMeta.v1Ms} ms` : "Not run"}
              </span>
            </div>
            <pre className="min-h-[88px] whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-800">
              {sandboxV1Out ||
                selectedCase?.v1Output ||
                "Click 'Run V1' or 'Run V1 & V2' to inspect baseline behavior."}
            </pre>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-900">
                Version 2 Output
              </span>
              <span className="font-mono text-slate-500 tabular-nums">
                {sandboxMeta.v2Ms !== undefined ? `${sandboxMeta.v2Ms} ms` : "Not run"}
              </span>
            </div>
            <pre className="min-h-[88px] whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-800">
              {sandboxV2Out ||
                selectedCase?.v2Output ||
                "Click 'Run V2' or 'Run V1 & V2' to test revised instructions."}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
