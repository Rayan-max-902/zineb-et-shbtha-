import { Pause, Play, RotateCcw, Shuffle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppState, PresenterSessionRecord } from "../types";

interface PresentationDrawViewProps {
  state: AppState;
  onUpdateDrawConfig: (patch: Partial<AppState["drawConfig"]>) => void;
  onAddDrawRecord: (record: PresenterSessionRecord) => void;
  onClearDrawHistory: () => void;
}

const TRANSPARENT_DRAW_SOURCE = `// Unbiased Fisher-Yates shuffle using Web Crypto API
function drawPresenters(
  totalStudents,   // e.g., 83
  alreadyPresented,// Set<number> of prior presenters
  count,           // 3 to 5 presenters per session
  allowRepeat      // false = exclude prior presenters
) {
  const pool = [];
  for (let id = 1; id <= totalStudents; id++) {
    if (allowRepeat || !alreadyPresented.has(id)) {
      pool.push(id);
    }
  }
  const rand = new Uint32Array(1);
  for (let i = pool.length - 1; i > 0; i--) {
    crypto.getRandomValues(rand);
    const j = rand[0] % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(count, pool.length));
}`;

function runCryptoDraw(
  totalStudents: number,
  alreadyPresented: Set<number>,
  count: number,
  allowRepeat: boolean
): { drawn: number[]; poolSize: number } {
  const pool: number[] = [];
  for (let id = 1; id <= totalStudents; id++) {
    if (allowRepeat || !alreadyPresented.has(id)) {
      pool.push(id);
    }
  }
  const poolSize = pool.length;
  const rand = new Uint32Array(1);
  for (let i = pool.length - 1; i > 0; i--) {
    window.crypto.getRandomValues(rand);
    const j = rand[0] % (i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return {
    drawn: pool.slice(0, Math.min(count, pool.length)),
    poolSize,
  };
}

export function PresentationDrawView({
  state,
  onUpdateDrawConfig,
  onAddDrawRecord,
  onClearDrawHistory,
}: PresentationDrawViewProps) {
  const { drawConfig, drawHistory, meta, testCases, v2 } = state;

  // Presentation / Q&A Timer state
  const [timerMode, setTimerMode] = useState<"presentation" | "qa">(
    "presentation"
  );
  const [secondsLeft, setSecondsLeft] = useState<number>(360); // 6 min default
  const [timerRunning, setTimerRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  function switchTimerMode(mode: "presentation" | "qa") {
    setTimerRunning(false);
    setTimerMode(mode);
    setSecondsLeft(mode === "presentation" ? 360 : 300);
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedClock = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // Presenter pool stats
  const priorSet = new Set<number>(
    drawHistory.flatMap((rec) => rec.drawnNumbers)
  );
  const eligibleCount = drawConfig.allowRepeat
    ? drawConfig.totalStudents
    : Math.max(0, drawConfig.totalStudents - priorSet.size);

  function handleRunDraw() {
    const { drawn, poolSize } = runCryptoDraw(
      drawConfig.totalStudents,
      priorSet,
      drawConfig.presentersPerSession,
      drawConfig.allowRepeat
    );
    if (drawn.length === 0) return;
    onAddDrawRecord({
      id: `draw-${Date.now()}`,
      sessionDate: drawConfig.sessionDate,
      drawnNumbers: drawn,
      poolSizeBeforeDraw: poolSize,
      excludedCount: drawConfig.allowRepeat ? 0 : priorSet.size,
      allowRepeat: drawConfig.allowRepeat,
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  const latestDraw = drawHistory[0];

  // Grounded findings summary for presentation outline
  const v1Reviewed = testCases.filter((t) => t.v1Status !== "pending");
  const v1ErrorCount = v1Reviewed.filter((t) => t.v1Status === "error").length;
  const v2Reviewed = testCases.filter((t) => t.v2Status !== "pending");
  const v2ErrorCount = v2Reviewed.filter((t) => t.v2Status === "error").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-6">
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-medium text-slate-500">
            05. In-Class Presentation &amp; Selection · Nov 12 – Dec 3 (Final 4 Weeks)
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Transparent class presenter draw and 5–7 minute talk studio
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Displays the exact random selection algorithm on screen for 83 students (3–5 presenters per session) alongside your talk outline, Q&amp;A prompts, and session timer.
          </p>
        </div>
      </div>

      {/* Section A: Transparent Random Draw */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Class Session Presenter Draw
              </h2>
              <p className="text-xs text-slate-500 tabular-nums">
                Eligible pool: {eligibleCount} of {drawConfig.totalStudents} students
              </p>
            </div>
            <button
              type="button"
              disabled={eligibleCount === 0}
              onClick={handleRunDraw}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Shuffle className="h-3.5 w-3.5" />
              Draw {drawConfig.presentersPerSession} Presenters
            </button>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Class Size
              </label>
              <input
                type="number"
                min={5}
                max={500}
                value={drawConfig.totalStudents}
                onChange={(e) =>
                  onUpdateDrawConfig({
                    totalStudents: Math.max(5, Number(e.target.value) || 83),
                  })
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Presenters per Session
              </label>
              <select
                value={drawConfig.presentersPerSession}
                onChange={(e) =>
                  onUpdateDrawConfig({
                    presentersPerSession: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value={3}>3 presenters</option>
                <option value={4}>4 presenters</option>
                <option value={5}>5 presenters</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Session Date
              </label>
              <select
                value={drawConfig.sessionDate}
                onChange={(e) =>
                  onUpdateDrawConfig({ sessionDate: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="Nov 12">Nov 12 (Week 1)</option>
                <option value="Nov 19">Nov 19 (Week 2)</option>
                <option value="Nov 26">Nov 26 (Week 3)</option>
                <option value="Dec 3">Dec 3 (Week 4)</option>
              </select>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={!drawConfig.allowRepeat}
              onChange={(e) =>
                onUpdateDrawConfig({ allowRepeat: !e.target.checked })
              }
              className="h-4 w-4 rounded border-slate-300 text-blue-700"
            />
            Exclude students who have already presented in prior sessions
          </label>

          {/* Latest Draw Display */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-5">
            <p className="text-xs font-medium text-slate-500">
              {latestDraw
                ? `Selected for ${latestDraw.sessionDate} · Drawn at ${latestDraw.timestamp}`
                : "No session draw executed yet"}
            </p>
            {latestDraw ? (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-3">
                {latestDraw.drawnNumbers.map((num) => (
                  <div
                    key={num}
                    className="rounded-lg border border-slate-200 bg-white py-3 text-center"
                  >
                    <p className="text-[11px] text-slate-500">Student</p>
                    <p className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                      #{String(num).padStart(2, "0")}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                Click &ldquo;Draw {drawConfig.presentersPerSession} Presenters&rdquo; to select student IDs transparently on screen.
              </p>
            )}
          </div>

          {/* Draw History */}
          {drawHistory.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700">
                  Session Draw Log ({drawHistory.length} session(s))
                </h3>
                <button
                  type="button"
                  onClick={onClearDrawHistory}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" />
                  Reset Draws
                </button>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg text-xs">
                {drawHistory.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <span className="font-medium text-slate-900">
                      {rec.sessionDate} ·{" "}
                      <span className="font-mono">
                        {rec.drawnNumbers
                          .map((n) => `#${String(n).padStart(2, "0")}`)
                          .join(", ")}
                      </span>
                    </span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      Pool: {rec.poolSizeBeforeDraw} · Excluded:{" "}
                      {rec.excludedCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Transparent Source Code Panel */}
        <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-slate-900 p-5 text-slate-100 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-semibold text-slate-100">
              Inspectable Selection Script (Shown on Screen)
            </h2>
            <span className="font-mono text-[11px] text-slate-400">
              crypto.getRandomValues
            </span>
          </div>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-slate-200">
            {TRANSPARENT_DRAW_SOURCE}
          </pre>
        </section>
      </div>

      {/* Section B: 5-7 Min Presentation & Q&A Studio */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Presentation Outline Grounded in User Data */}
        <section className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              5–7 Minute Presentation Talking Points
            </h2>
            <p className="text-xs text-slate-500">
              Auto-populated from your current Task, Instructions, and Verification Log
            </p>
          </div>

          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-900">
                01. The Narrow Task (~1 min)
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                {meta.taskSummary} Output format:{" "}
                <span className="font-mono text-slate-800">
                  {meta.outputSchemaSummary}
                </span>
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-900">
                02. Version 1 to Version 2 Evolution (~1.5 min)
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                {v2.rationale ||
                  "Explain what Version 1 got wrong and which explicit restrictions or uncertainty rules you added in Version 2."}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-900">
                03. Key Findings from the Verification Log (~2 min)
              </p>
              <p className="text-xs leading-relaxed text-slate-600 tabular-nums">
                Corpus size: {testCases.length} inputs (
                {testCases.filter((t) => t.isTricky).length} tricky cases). V1
                logged {v1ErrorCount} error(s) across {v1Reviewed.length}{" "}
                reviewed runs; V2 logged {v2ErrorCount} error(s) across{" "}
                {v2Reviewed.length} reviewed runs. Walk through 1–2 concrete error rows on screen.
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-900">
                04. Main Reflection Takeaway (~1 min)
              </p>
              <p className="text-xs leading-relaxed text-slate-600">
                {state.reflection.untrustedTasks
                  ? state.reflection.untrustedTasks.slice(0, 220) +
                    (state.reflection.untrustedTasks.length > 220 ? "..." : "")
                  : "Summarize when the assistant can be trusted vs. when independent verification is mandatory."}
              </p>
            </div>
          </div>
        </section>

        {/* Session Timer & Q&A Prep */}
        <section className="lg:col-span-5 space-y-6">
          {/* Timer */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => switchTimerMode("presentation")}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    timerMode === "presentation"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Talk (6:00)
                </button>
                <button
                  type="button"
                  onClick={() => switchTimerMode("qa")}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${
                    timerMode === "qa"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Q&amp;A (5:00)
                </button>
              </div>

              <span className="font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formattedClock}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTimerRunning((r) => !r)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {timerRunning ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Start Timer
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => switchTimerMode(timerMode)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* Expected Q&A Questions */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Expected Q&amp;A Questions (5 Minutes)
            </h3>
            <ul className="space-y-2.5 text-xs leading-relaxed text-slate-600 list-disc pl-4">
              <li>
                <strong className="text-slate-900">
                  How did you verify this output?
                </strong>{" "}
                Point to your independent source or written pre-test labeling rules.
              </li>
              <li>
                <strong className="text-slate-900">
                  Why did you classify this as an error?
                </strong>{" "}
                Cite the exact taxonomy rule (e.g., Omission of Uncertainty vs. Misinterpretation).
              </li>
              <li>
                <strong className="text-slate-900">
                  What would you change in your instructions, and why?
                </strong>{" "}
                Explain what V2 fixed and what edge cases still resist prompting alone.
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
