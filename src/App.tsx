import { useEffect, useState } from "react";
import { PaperReflectionView } from "./components/PaperReflectionView";
import { PresentationDrawView } from "./components/PresentationDrawView";
import { PromptLabView } from "./components/PromptLabView";
import { TaskRulesView } from "./components/TaskRulesView";
import { TopBar } from "./components/TopBar";
import { VerificationLogView } from "./components/VerificationLogView";
import { PRESETS } from "./data/presets";
import type {
  AppState,
  AppTab,
  AssistantVersion,
  PresenterSessionRecord,
  ProcessLogEntry,
  ProjectMeta,
  ReflectionSections,
  TestCaseRow,
} from "./types";

const STORAGE_KEY = "benchaudit_project_v1";

function createInitialState(presetId = "bank-categorizer"): AppState {
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  return {
    meta: { ...preset.meta },
    v1: { ...preset.v1 },
    v2: { ...preset.v2 },
    testCases: preset.testCases.map((tc) => ({ ...tc })),
    processLog: [],
    reflection: { ...preset.reflection },
    drawConfig: {
      totalStudents: 83,
      presentersPerSession: 4,
      allowRepeat: false,
      sessionDate: "Nov 19",
    },
    drawHistory: [],
  };
}

function loadSavedState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    if (!parsed.meta || !parsed.v1 || !parsed.v2 || !parsed.testCases) {
      return createInitialState();
    }
    return {
      ...createInitialState(),
      ...parsed,
    };
  } catch {
    return createInitialState();
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("task-rules");
  const [state, setState] = useState<AppState>(() => loadSavedState());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors cleanly
    }
  }, [state]);

  function handleUpdateMeta(patch: Partial<ProjectMeta>) {
    setState((prev) => ({
      ...prev,
      meta: { ...prev.meta, ...patch },
    }));
  }

  function handleApplyPreset(presetId: string) {
    const next = createInitialState(presetId);
    setState((prev) => ({
      ...next,
      meta: {
        ...next.meta,
        studentName: prev.meta.studentName,
      },
      drawConfig: prev.drawConfig,
      drawHistory: prev.drawHistory,
    }));
  }

  function handleChangeV1(patch: Partial<AssistantVersion>) {
    setState((prev) => ({ ...prev, v1: { ...prev.v1, ...patch } }));
  }

  function handleChangeV2(patch: Partial<AssistantVersion>) {
    setState((prev) => ({ ...prev, v2: { ...prev.v2, ...patch } }));
  }

  function handleCopyV1ToV2() {
    setState((prev) => ({
      ...prev,
      v2: {
        ...prev.v1,
        rationale: prev.v2.rationale ?? "",
      },
    }));
  }

  function handleRecordRun(
    entry: ProcessLogEntry,
    testCaseId?: string,
    output?: string,
    latencyMs?: number
  ) {
    setState((prev) => {
      const updatedCases = testCaseId
        ? prev.testCases.map((tc) => {
            if (tc.id !== testCaseId) return tc;
            if (entry.version === "V1") {
              return {
                ...tc,
                v1Output: output ?? entry.outputReceived,
                v1LatencyMs: latencyMs ?? entry.latencyMs,
                v1Timestamp: entry.timestamp,
              };
            }
            return {
              ...tc,
              v2Output: output ?? entry.outputReceived,
              v2LatencyMs: latencyMs ?? entry.latencyMs,
              v2Timestamp: entry.timestamp,
            };
          })
        : prev.testCases;

      return {
        ...prev,
        testCases: updatedCases,
        processLog: [entry, ...prev.processLog],
      };
    });
  }

  function handleAddTestCase(row: TestCaseRow) {
    setState((prev) => ({
      ...prev,
      testCases: [...prev.testCases, row],
    }));
  }

  function handleUpdateTestCase(id: string, patch: Partial<TestCaseRow>) {
    setState((prev) => ({
      ...prev,
      testCases: prev.testCases.map((tc) =>
        tc.id === id ? { ...tc, ...patch } : tc
      ),
    }));
  }

  function handleDeleteTestCase(id: string) {
    setState((prev) => ({
      ...prev,
      testCases: prev.testCases.filter((tc) => tc.id !== id),
    }));
  }

  function handleUpdateReflection(patch: Partial<ReflectionSections>) {
    setState((prev) => ({
      ...prev,
      reflection: { ...prev.reflection, ...patch },
    }));
  }

  function handleUpdateDrawConfig(patch: Partial<AppState["drawConfig"]>) {
    setState((prev) => ({
      ...prev,
      drawConfig: { ...prev.drawConfig, ...patch },
    }));
  }

  function handleAddDrawRecord(record: PresenterSessionRecord) {
    setState((prev) => ({
      ...prev,
      drawHistory: [record, ...prev.drawHistory],
    }));
  }

  function handleClearDrawHistory() {
    setState((prev) => ({
      ...prev,
      drawHistory: [],
    }));
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onExportPaper={() => setActiveTab("paper")}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8">
        {activeTab === "task-rules" && (
          <TaskRulesView
            meta={state.meta}
            onUpdateMeta={handleUpdateMeta}
            onApplyPreset={handleApplyPreset}
            onGoToPromptLab={() => setActiveTab("prompt-lab")}
          />
        )}

        {activeTab === "prompt-lab" && (
          <PromptLabView
            v1={state.v1}
            v2={state.v2}
            testCases={state.testCases}
            onChangeV1={handleChangeV1}
            onChangeV2={handleChangeV2}
            onCopyV1ToV2={handleCopyV1ToV2}
            onRecordRun={handleRecordRun}
            onGoToVerification={() => setActiveTab("verification")}
          />
        )}

        {activeTab === "verification" && (
          <VerificationLogView
            v1={state.v1}
            v2={state.v2}
            testCases={state.testCases}
            onAddTestCase={handleAddTestCase}
            onUpdateTestCase={handleUpdateTestCase}
            onDeleteTestCase={handleDeleteTestCase}
            onRecordRun={handleRecordRun}
          />
        )}

        {activeTab === "paper" && (
          <PaperReflectionView
            state={state}
            onUpdateReflection={handleUpdateReflection}
          />
        )}

        {activeTab === "presentation" && (
          <PresentationDrawView
            state={state}
            onUpdateDrawConfig={handleUpdateDrawConfig}
            onAddDrawRecord={handleAddDrawRecord}
            onClearDrawHistory={handleClearDrawHistory}
          />
        )}
      </main>

      <footer className="no-print border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-6 py-4 text-xs text-slate-500">
          <span>
            BenchAudit · Evidence-first AI assistant evaluation workbench
          </span>
          <div className="flex items-center gap-4 tabular-nums">
            <span>{state.testCases.length} inputs in corpus</span>
            <span aria-hidden="true">·</span>
            <span>{state.processLog.length} logged runs</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => handleApplyPreset(state.meta.presetId)}
              className="text-slate-600 hover:text-slate-900 underline underline-offset-2"
            >
              Reset Current Preset
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
