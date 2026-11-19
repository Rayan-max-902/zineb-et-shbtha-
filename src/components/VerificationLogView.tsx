import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Play,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import type {
  AssistantVersion,
  ErrorType,
  ProcessLogEntry,
  TestCaseRow,
  VerificationStatus,
} from "../types";
import { runAssistantOnServer } from "../utils/api";
import { formatSystemInstruction } from "../utils/diff";
import { scanAndSanitizePii } from "../utils/privacy";

interface VerificationLogViewProps {
  v1: AssistantVersion;
  v2: AssistantVersion;
  testCases: TestCaseRow[];
  onAddTestCase: (row: TestCaseRow) => void;
  onUpdateTestCase: (id: string, patch: Partial<TestCaseRow>) => void;
  onDeleteTestCase: (id: string) => void;
  onRecordRun: (
    entry: ProcessLogEntry,
    testCaseId: string,
    output: string,
    latencyMs: number
  ) => void;
}

const ERROR_TYPES: ErrorType[] = [
  "Unreviewed",
  "None",
  "Fabricated Information",
  "Misinterpretation",
  "Failure to Follow Instructions",
  "Superficiality",
  "Omission of Uncertainty",
  "Format Violation",
];

type FilterMode = "all" | "standard" | "tricky" | "errors" | "unreviewed";

export function VerificationLogView({
  v1,
  v2,
  testCases,
  onAddTestCase,
  onUpdateTestCase,
  onDeleteTestCase,
  onRecordRun,
}: VerificationLogViewProps) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [expandedId, setExpandedId] = useState<string | null>(
    testCases[0]?.id ?? null
  );
  const [runningRowKey, setRunningRowKey] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState<{
    version: "V1" | "V2";
    current: number;
    total: number;
  } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Add new input state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newLabel, setNewLabel] = useState<string>("");
  const [newRawText, setNewRawText] = useState<string>("");
  const [newIsTricky, setNewIsTricky] = useState<boolean>(false);
  const [newTrickyReason, setNewTrickyReason] = useState<string>("");
  const [newExpectedCheck, setNewExpectedCheck] = useState<string>("");

  const newPiiScan = scanAndSanitizePii(newRawText);

  const trickyCount = testCases.filter((t) => t.isTricky).length;

  const v1Reviewed = testCases.filter((t) => t.v1Status !== "pending");
  const v1Errors = v1Reviewed.filter((t) => t.v1Status === "error");
  const v2Reviewed = testCases.filter((t) => t.v2Status !== "pending");
  const v2Errors = v2Reviewed.filter((t) => t.v2Status === "error");

  const v1ErrorBreakdown = ERROR_TYPES.filter(
    (et) => et !== "Unreviewed" && et !== "None"
  ).map((et) => ({
    type: et,
    v1Count: testCases.filter((t) => t.v1ErrorType === et).length,
    v2Count: testCases.filter((t) => t.v2ErrorType === et).length,
  }));

  const filteredCases = testCases.filter((tc) => {
    if (filter === "standard") return !tc.isTricky;
    if (filter === "tricky") return tc.isTricky;
    if (filter === "errors")
      return tc.v1Status === "error" || tc.v2Status === "error";
    if (filter === "unreviewed")
      return tc.v1Status === "pending" || tc.v2Status === "pending";
    return true;
  });

  async function runSingle(row: TestCaseRow, version: "V1" | "V2") {
    setApiError(null);
    setRunningRowKey(`${row.id}-${version}`);
    const systemInstruction = formatSystemInstruction(
      version === "V1" ? v1 : v2
    );
    const pii = scanAndSanitizePii(row.anonymizedText);
    const safeInput = pii.hasPii ? pii.sanitizedText : row.anonymizedText;

    try {
      const res = await runAssistantOnServer(systemInstruction, safeInput);
      onRecordRun(
        {
          id: `run-${Date.now()}-${version}-${row.id}`,
          version,
          testCaseId: row.id,
          testCaseLabel: row.label,
          systemInstruction,
          inputSent: safeInput,
          outputReceived: res.outputText,
          model: res.model,
          latencyMs: res.latencyMs,
          timestamp: res.timestamp,
        },
        row.id,
        res.outputText,
        res.latencyMs
      );
    } catch (err: unknown) {
      setApiError(
        err instanceof Error ? err.message : "Assistant request failed."
      );
    } finally {
      setRunningRowKey(null);
    }
  }

  async function runBatch(version: "V1" | "V2") {
    setApiError(null);
    const pendingRows = testCases.filter((row) =>
      version === "V1" ? !row.v1Output : !row.v2Output
    );
    const queue = pendingRows.length > 0 ? pendingRows : testCases;
    if (queue.length === 0) return;

    const systemInstruction = formatSystemInstruction(
      version === "V1" ? v1 : v2
    );
    setBatchProgress({ version, current: 0, total: queue.length });

    for (let i = 0; i < queue.length; i++) {
      const row = queue[i];
      setBatchProgress({ version, current: i + 1, total: queue.length });
      const pii = scanAndSanitizePii(row.anonymizedText);
      const safeInput = pii.hasPii ? pii.sanitizedText : row.anonymizedText;

      try {
        const res = await runAssistantOnServer(systemInstruction, safeInput);
        onRecordRun(
          {
            id: `run-${Date.now()}-${version}-${row.id}`,
            version,
            testCaseId: row.id,
            testCaseLabel: row.label,
            systemInstruction,
            inputSent: safeInput,
            outputReceived: res.outputText,
            model: res.model,
            latencyMs: res.latencyMs,
            timestamp: res.timestamp,
          },
          row.id,
          res.outputText,
          res.latencyMs
        );
      } catch (err: unknown) {
        setApiError(
          err instanceof Error
            ? `Stopped at input #${i + 1} (${row.label}): ${err.message}`
            : "Batch run stopped due to an error."
        );
        break;
      }
    }

    setBatchProgress(null);
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newRawText.trim()) return;
    const sanitized = newPiiScan.sanitizedText;
    const newRow: TestCaseRow = {
      id: `tc-${Date.now()}`,
      label: newLabel.trim().toUpperCase(),
      rawText: newRawText.trim(),
      anonymizedText: sanitized,
      isTricky: newIsTricky,
      trickyReason: newIsTricky ? newTrickyReason.trim() : "",
      expectedCheck: newExpectedCheck.trim(),
      v1Output: "",
      v1LatencyMs: null,
      v1Timestamp: null,
      v1Status: "pending",
      v1ErrorType: "Unreviewed",
      v1Correction: "",
      v2Output: "",
      v2LatencyMs: null,
      v2Timestamp: null,
      v2Status: "pending",
      v2ErrorType: "Unreviewed",
      v2Correction: "",
    };
    onAddTestCase(newRow);
    setExpandedId(newRow.id);
    setNewLabel("");
    setNewRawText("");
    setNewIsTricky(false);
    setNewTrickyReason("");
    setNewExpectedCheck("");
    setShowAddForm(false);
  }

  function renderStatusTag(status: VerificationStatus, errorType: ErrorType) {
    if (status === "verified") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Verified
        </span>
      );
    }
    if (status === "error") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {errorType !== "Unreviewed" && errorType !== "None"
            ? errorType
            : "Error"}
        </span>
      );
    }
    return <span className="text-xs text-slate-400">Pending check</span>;
  }

  return (
    <div className="space-y-8">
      {/* Header & Batch Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-medium text-slate-500">
            03. Empirical Testing &amp; Error Audit · Target: 10+ Real Inputs (3+ Tricky)
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Test real inputs, verify every output, and classify failures
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Run Version 1 across your corpus, check each output independently against your labeling rules, then re-test Version 2 on the same inputs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={batchProgress !== null}
            onClick={() => runBatch("V1")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            {batchProgress?.version === "V1"
              ? `Running V1 (${batchProgress.current}/${batchProgress.total})`
              : "Run V1 Batch"}
          </button>
          <button
            type="button"
            disabled={batchProgress !== null}
            onClick={() => runBatch("V2")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Play className="h-3.5 w-3.5" />
            {batchProgress?.version === "V2"
              ? `Running V2 (${batchProgress.current}/${batchProgress.total})`
              : "Run V2 Batch"}
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Test Input
          </button>
        </div>
      </div>

      {apiError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3.5 text-xs text-red-800">
          {apiError}
        </div>
      )}

      {/* Real Computed Metrics Strip (No Hallucinated Scoreboards) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Inputs</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {testCases.length}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {testCases.length >= 10
              ? "Meets 10+ tested minimum"
              : `${10 - testCases.length} more needed for 10`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Tricky / Edge Cases</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {trickyCount}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {trickyCount >= 3
              ? "Meets 3+ tricky minimum"
              : `${3 - trickyCount} more needed for 3`}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">V1 Reviewed Errors</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {v1Reviewed.length > 0
              ? `${v1Errors.length}/${v1Reviewed.length}`
              : "0/0"}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {v1Reviewed.length > 0
              ? `${Math.round((v1Errors.length / v1Reviewed.length) * 100)}% error rate on reviewed`
              : "Run and review V1 outputs"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">V2 Reviewed Errors</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {v2Reviewed.length > 0
              ? `${v2Errors.length}/${v2Reviewed.length}`
              : "0/0"}
          </p>
          <p className="mt-1 text-xs text-slate-600 tabular-nums">
            {v2Reviewed.length > 0
              ? `${Math.round((v2Errors.length / v2Reviewed.length) * 100)}% error rate on reviewed`
              : "Run and review V2 outputs"}
          </p>
        </div>
      </div>

      {/* Add Input Form with Live Privacy Scrubber */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="rounded-xl border border-slate-300 bg-white p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-slate-900">
              Add New Real Input (with Local Privacy Scrubber)
            </h2>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Short Identifier / Label
              </label>
              <input
                type="text"
                required
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. PHARMACY RECEIPT #21"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Independent Expected Check (Ground Truth)
              </label>
              <input
                type="text"
                value={newExpectedCheck}
                onChange={(e) => setNewExpectedCheck(e.target.value)}
                placeholder="What your independent verification expects..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Input Text
            </label>
            <textarea
              rows={3}
              required
              value={newRawText}
              onChange={(e) => setNewRawText(e.target.value)}
              placeholder="Paste raw input here. Emails, IBANs, phone numbers, and long account numbers will be scrubbed automatically..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          {newPiiScan.hasPii && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  Detected {newPiiScan.detections.length} PII item(s) — auto-redacted preview:
                </div>
                <button
                  type="button"
                  onClick={() => setNewRawText(newPiiScan.sanitizedText)}
                  className="rounded-md bg-amber-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-950"
                >
                  Apply Redaction Now
                </button>
              </div>
              <p className="font-mono text-xs text-amber-950 break-words">
                {newPiiScan.sanitizedText}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newIsTricky}
                  onChange={(e) => setNewIsTricky(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-700"
                />
                Mark as Tricky / Edge Case
              </label>
              {newIsTricky && (
                <input
                  type="text"
                  value={newTrickyReason}
                  onChange={(e) => setNewTrickyReason(e.target.value)}
                  placeholder="Why is this tricky? (missing info, ambiguous...)"
                  className="w-72 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                />
              )}
            </div>

            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              Add Anonymized Input
            </button>
          </div>
        </form>
      )}

      {/* Filter Bar + Verification Table */}
      <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                ["all", `All (${testCases.length})`],
                ["standard", `Standard (${testCases.length - trickyCount})`],
                ["tricky", `Tricky (${trickyCount})`],
                ["errors", "Has Error"],
                ["unreviewed", "Pending Review"],
              ] as Array<[FilterMode, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  filter === key
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-500">
            Click any row to run, inspect output, and classify error type
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 pl-6 pr-3 w-10 tabular-nums">#</th>
                <th className="py-3 px-3">Input</th>
                <th className="py-3 px-3">V1 Result</th>
                <th className="py-3 px-3">V2 Result</th>
                <th className="py-3 px-3">Independent Check</th>
                <th className="py-3 pl-3 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredCases.map((row, idx) => {
                const isExpanded = expandedId === row.id;
                return (
                  <tr
                    key={row.id}
                    className={`group transition-colors ${
                      isExpanded ? "bg-blue-50/30" : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className="py-3 pl-6 pr-3 align-top font-mono text-xs text-slate-500 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-3 align-top max-w-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : row.id)
                        }
                        className="text-left focus:outline-none"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                          <span>{row.label}</span>
                          {row.isTricky && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-700">Tricky</span>
                            </>
                          )}
                        </div>
                        <p className="mt-0.5 font-mono text-xs text-slate-600 line-clamp-2">
                          {row.anonymizedText}
                        </p>
                      </button>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[200px]">
                      <div className="space-y-1">
                        {renderStatusTag(row.v1Status, row.v1ErrorType)}
                        <p className="font-mono text-xs text-slate-600 line-clamp-2">
                          {row.v1Output || "—"}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[200px]">
                      <div className="space-y-1">
                        {renderStatusTag(row.v2Status, row.v2ErrorType)}
                        <p className="font-mono text-xs text-slate-600 line-clamp-2">
                          {row.v2Output || "—"}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 px-3 align-top max-w-[180px] text-xs text-slate-600">
                      {row.expectedCheck || "—"}
                    </td>
                    <td className="py-3 pl-3 pr-6 align-top text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : row.id)
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        {isExpanded ? (
                          <>
                            Close <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            Audit <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expanded Audit Drawer for Active Row */}
        {expandedId &&
          (() => {
            const active = testCases.find((t) => t.id === expandedId);
            if (!active) return null;
            return (
              <div className="border-t border-slate-200 bg-slate-50/70 p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-900">
                        Auditing: {active.label}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {active.isTricky
                          ? `Tricky Case: ${active.trickyReason || "Edge case"}`
                          : "Standard Case"}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-slate-800 bg-white border border-slate-200 rounded-lg px-3 py-2">
                      {active.anonymizedText}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onDeleteTestCase(active.id);
                      setExpandedId(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Input
                  </button>
                </div>

                {/* Expected Ground Truth */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Your Independent Check (Expected Ground Truth)
                  </label>
                  <input
                    type="text"
                    value={active.expectedCheck}
                    onChange={(e) =>
                      onUpdateTestCase(active.id, {
                        expectedCheck: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                  />
                </div>

                {/* V1 & V2 Audit Panels */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {/* V1 Audit */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">
                        Version 1 Output &amp; Verification
                      </span>
                      <button
                        type="button"
                        disabled={runningRowKey === `${active.id}-V1`}
                        onClick={() => runSingle(active, "V1")}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Play className="h-3 w-3" />
                        {runningRowKey === `${active.id}-V1`
                          ? "Running..."
                          : "Run V1"}
                      </button>
                    </div>

                    <pre className="min-h-[72px] rounded-lg bg-slate-50 border border-slate-200 p-3 font-mono text-xs text-slate-800 whitespace-pre-wrap break-words">
                      {active.v1Output || "Not run yet."}
                    </pre>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Verdict
                        </label>
                        <select
                          value={active.v1Status}
                          onChange={(e) => {
                            const status = e.target.value as VerificationStatus;
                            onUpdateTestCase(active.id, {
                              v1Status: status,
                              v1ErrorType:
                                status === "verified"
                                  ? "None"
                                  : active.v1ErrorType === "None"
                                    ? "Unreviewed"
                                    : active.v1ErrorType,
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                        >
                          <option value="pending">Pending review</option>
                          <option value="verified">Verified (No error)</option>
                          <option value="error">Error logged</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Error Type
                        </label>
                        <select
                          value={active.v1ErrorType}
                          onChange={(e) => {
                            const errorType = e.target.value as ErrorType;
                            onUpdateTestCase(active.id, {
                              v1ErrorType: errorType,
                              v1Status:
                                errorType === "None"
                                  ? "verified"
                                  : errorType === "Unreviewed"
                                    ? "pending"
                                    : "error",
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                        >
                          {ERROR_TYPES.map((et) => (
                            <option key={et} value={et}>
                              {et}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        V1 Correction / Note
                      </label>
                      <input
                        type="text"
                        value={active.v1Correction}
                        onChange={(e) =>
                          onUpdateTestCase(active.id, {
                            v1Correction: e.target.value,
                          })
                        }
                        placeholder="What should the output have been, and why did V1 fail?"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  {/* V2 Audit */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-900">
                        Version 2 Output &amp; Verification
                      </span>
                      <button
                        type="button"
                        disabled={runningRowKey === `${active.id}-V2`}
                        onClick={() => runSingle(active, "V2")}
                        className="inline-flex items-center gap-1 rounded-md bg-blue-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                      >
                        <Play className="h-3 w-3" />
                        {runningRowKey === `${active.id}-V2`
                          ? "Running..."
                          : "Run V2"}
                      </button>
                    </div>

                    <pre className="min-h-[72px] rounded-lg bg-slate-50 border border-slate-200 p-3 font-mono text-xs text-slate-800 whitespace-pre-wrap break-words">
                      {active.v2Output || "Not run yet."}
                    </pre>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Verdict
                        </label>
                        <select
                          value={active.v2Status}
                          onChange={(e) => {
                            const status = e.target.value as VerificationStatus;
                            onUpdateTestCase(active.id, {
                              v2Status: status,
                              v2ErrorType:
                                status === "verified"
                                  ? "None"
                                  : active.v2ErrorType === "None"
                                    ? "Unreviewed"
                                    : active.v2ErrorType,
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                        >
                          <option value="pending">Pending review</option>
                          <option value="verified">Verified (No error)</option>
                          <option value="error">Error logged</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Error Type
                        </label>
                        <select
                          value={active.v2ErrorType}
                          onChange={(e) => {
                            const errorType = e.target.value as ErrorType;
                            onUpdateTestCase(active.id, {
                              v2ErrorType: errorType,
                              v2Status:
                                errorType === "None"
                                  ? "verified"
                                  : errorType === "Unreviewed"
                                    ? "pending"
                                    : "error",
                            });
                          }}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                        >
                          {ERROR_TYPES.map((et) => (
                            <option key={et} value={et}>
                              {et}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        V2 Correction / Remaining Boundary
                      </label>
                      <input
                        type="text"
                        value={active.v2Correction}
                        onChange={(e) =>
                          onUpdateTestCase(active.id, {
                            v2Correction: e.target.value,
                          })
                        }
                        placeholder="Did V2 resolve the V1 failure, or did a new edge case fail?"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
      </section>

      {/* Error Taxonomy Breakdown Table */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Observed Error Breakdown (Version 1 vs Version 2)
          </h2>
          <span className="text-xs text-slate-500">
            Computed directly from verified log entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4 font-medium">Error Category</th>
                <th className="py-2 px-4 font-medium text-right tabular-nums">
                  Version 1 Count
                </th>
                <th className="py-2 pl-4 font-medium text-right tabular-nums">
                  Version 2 Count
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {v1ErrorBreakdown.map((item) => (
                <tr key={item.type}>
                  <td className="py-2 pr-4 font-medium text-slate-800">
                    {item.type}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-slate-700 tabular-nums">
                    {item.v1Count}
                  </td>
                  <td className="py-2 pl-4 text-right font-mono text-slate-700 tabular-nums">
                    {item.v2Count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
