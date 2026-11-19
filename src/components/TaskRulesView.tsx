import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { PRESETS } from "../data/presets";
import type { ProjectMeta } from "../types";
import { checkProhibitedTask } from "../utils/privacy";

interface TaskRulesViewProps {
  meta: ProjectMeta;
  onUpdateMeta: (patch: Partial<ProjectMeta>) => void;
  onApplyPreset: (presetId: string) => void;
  onGoToPromptLab: () => void;
}

export function TaskRulesView({
  meta,
  onUpdateMeta,
  onApplyPreset,
  onGoToPromptLab,
}: TaskRulesViewProps) {
  const policyCheck = checkProhibitedTask(
    `${meta.projectTitle} ${meta.taskSummary} ${meta.outputSchemaSummary}`
  );

  const checksCompleted = Object.values(meta.eligibilityConfirmed).filter(
    Boolean
  ).length;

  return (
    <div className="space-y-8">
      {/* Page Intro + Starter Preset Selector */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-medium text-slate-500">
            01. Task Definition &amp; Verification Criteria · Individual Project (40% Weight)
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Define one narrow, checkable task before running a single prompt
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            The objective is not to build a universally helpful assistant, but to establish empirical evidence of where it succeeds and where it breaks down.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onGoToPromptLab}
            className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            Continue to Prompt Lab
          </button>
        </div>
      </div>

      {/* Preset Selection Row */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Starter Templates (or customize all fields below)
          </h2>
          <span className="text-xs text-slate-500">
            3 syllabus-compliant task archetypes
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PRESETS.map((preset) => {
            const isSelected = meta.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset.id)}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  isSelected
                    ? "border-blue-700 bg-blue-50/40"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {preset.title}
                  </span>
                  <span className="text-xs font-medium text-slate-500 tabular-nums shrink-0">
                    {isSelected ? "Active" : `${preset.testCases.length} inputs`}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                  {preset.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
        {/* Left 7 cols: Task Specification & Pre-Test Labeling Rules */}
        <div className="lg:col-span-7 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="studentName"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Author / Student Name
              </label>
              <input
                id="studentName"
                type="text"
                value={meta.studentName}
                onChange={(e) => onUpdateMeta({ studentName: e.target.value })}
                placeholder="e.g. Alex Rivera"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="courseName"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Course / Seminar
              </label>
              <input
                id="courseName"
                type="text"
                value={meta.courseName}
                onChange={(e) => onUpdateMeta({ courseName: e.target.value })}
                placeholder="e.g. Research Methods"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="projectTitle"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Written Paper Title
            </label>
            <input
              id="projectTitle"
              type="text"
              value={meta.projectTitle}
              onChange={(e) => onUpdateMeta({ projectTitle: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="taskSummary"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Fixed Narrow Job (One job, one output format)
            </label>
            <textarea
              id="taskSummary"
              rows={3}
              value={meta.taskSummary}
              onChange={(e) => onUpdateMeta({ taskSummary: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="outputSchemaSummary"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Expected Output Format
              </label>
              <input
                id="outputSchemaSummary"
                type="text"
                value={meta.outputSchemaSummary}
                onChange={(e) =>
                  onUpdateMeta({ outputSchemaSummary: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="dataSourceNote"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Real Input Source (Target 15 inputs / 10+ tested)
              </label>
              <input
                id="dataSourceNote"
                type="text"
                value={meta.dataSourceNote}
                onChange={(e) =>
                  onUpdateMeta({ dataSourceNote: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="labelingRules"
                className="block text-xs font-medium text-slate-700"
              >
                Written Labeling Rules (Defined Before Testing)
              </label>
              <span className="text-xs text-slate-500">
                Included in final paper
              </span>
            </div>
            <textarea
              id="labelingRules"
              rows={5}
              value={meta.labelingRules}
              onChange={(e) => onUpdateMeta({ labelingRules: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Right 5 cols: Eligibility Gate, Prohibited Domain Check, Privacy Policy */}
        <div className="lg:col-span-5 space-y-6">
          {/* Prohibited Task Detector */}
          <div
            className={`rounded-xl border p-5 ${
              policyCheck.flagged
                ? "border-red-300 bg-red-50/60"
                : "border-emerald-200 bg-emerald-50/40"
            }`}
          >
            <div className="flex items-start gap-3">
              {policyCheck.flagged ? (
                <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-slate-900">
                  {policyCheck.flagged
                    ? "Policy Alert: Review Prohibited Domains"
                    : "Policy Check Passed: Non-Advisory Verifiable Task"}
                </p>
                {policyCheck.flagged ? (
                  <ul className="space-y-1 text-xs text-red-800 list-disc pl-4">
                    {policyCheck.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs leading-relaxed text-slate-600">
                    No health, legal, financial-advice, or uncheckable subjective terms detected in your task definition.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 4-Condition Checklist */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Syllabus Eligibility Gate
              </h2>
              <span className="font-mono text-xs font-medium text-slate-600 tabular-nums">
                {checksCompleted}/4 confirmed
              </span>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meta.eligibilityConfirmed.narrowRepeatable}
                  onChange={(e) =>
                    onUpdateMeta({
                      eligibilityConfirmed: {
                        ...meta.eligibilityConfirmed,
                        narrowRepeatable: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                />
                <span className="text-xs leading-relaxed text-slate-700">
                  <strong className="font-semibold text-slate-900">
                    Narrow and repeatable:
                  </strong>{" "}
                  One fixed job and one output schema (no general-purpose assistants).
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meta.eligibilityConfirmed.easyToFeed}
                  onChange={(e) =>
                    onUpdateMeta({
                      eligibilityConfirmed: {
                        ...meta.eligibilityConfirmed,
                        easyToFeed: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                />
                <span className="text-xs leading-relaxed text-slate-700">
                  <strong className="font-semibold text-slate-900">
                    Easy to feed:
                  </strong>{" "}
                  At least 10 tested real inputs (15 gathered), including at least 3 tricky or misleading inputs.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meta.eligibilityConfirmed.checkableRulesFirst}
                  onChange={(e) =>
                    onUpdateMeta({
                      eligibilityConfirmed: {
                        ...meta.eligibilityConfirmed,
                        checkableRulesFirst: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                />
                <span className="text-xs leading-relaxed text-slate-700">
                  <strong className="font-semibold text-slate-900">
                    Checkable ground truth:
                  </strong>{" "}
                  Every output can be independently verified using the labeling rules written above.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meta.eligibilityConfirmed.privacySanitized}
                  onChange={(e) =>
                    onUpdateMeta({
                      eligibilityConfirmed: {
                        ...meta.eligibilityConfirmed,
                        privacySanitized: e.target.checked,
                      },
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                />
                <span className="text-xs leading-relaxed text-slate-700">
                  <strong className="font-semibold text-slate-900">
                    Privacy sanitized:
                  </strong>{" "}
                  Names, phone numbers, addresses, IBANs, and account numbers are removed before API submission.
                </span>
              </label>
            </div>
          </div>

          {/* Privacy Rules Reference */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2.5">
            <div className="flex items-center gap-2 text-slate-900">
              <ShieldCheck className="h-4 w-4 text-blue-700 shrink-0" />
              <h2 className="text-sm font-semibold">
                Privacy Redaction Safeguards
              </h2>
            </div>
            <p className="text-xs leading-relaxed text-slate-600">
              In the Verification Log, BenchAudit automatically scans inputs for emails, IBANs, phone numbers, and account numbers and scrubs them locally before sending any prompt to the Gemini API. Do not upload other people&apos;s private messages without anonymizing them first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
