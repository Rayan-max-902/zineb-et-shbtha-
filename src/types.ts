export type AppTab =
  | "task-rules"
  | "prompt-lab"
  | "verification"
  | "paper"
  | "presentation";

export type ErrorType =
  | "Unreviewed"
  | "None"
  | "Fabricated Information"
  | "Misinterpretation"
  | "Failure to Follow Instructions"
  | "Superficiality"
  | "Omission of Uncertainty"
  | "Format Violation";

export type VerificationStatus = "pending" | "verified" | "error";

export interface AssistantVersion {
  role: string;
  task: string;
  restrictions: string;
  outputFormat: string;
  rationale?: string;
}

export interface TestCaseRow {
  id: string;
  label: string;
  rawText: string;
  anonymizedText: string;
  isTricky: boolean;
  trickyReason: string;
  expectedCheck: string;
  v1Output: string;
  v1LatencyMs: number | null;
  v1Timestamp: string | null;
  v1Status: VerificationStatus;
  v1ErrorType: ErrorType;
  v1Correction: string;
  v2Output: string;
  v2LatencyMs: number | null;
  v2Timestamp: string | null;
  v2Status: VerificationStatus;
  v2ErrorType: ErrorType;
  v2Correction: string;
}

export interface ProcessLogEntry {
  id: string;
  version: "V1" | "V2";
  testCaseId: string;
  testCaseLabel: string;
  systemInstruction: string;
  inputSent: string;
  outputReceived: string;
  model: string;
  latencyMs: number;
  timestamp: string;
}

export interface ReflectionSections {
  withoutAi: string;
  untrustedTasks: string;
  ethicalMethodological: string;
}

export interface ProjectMeta {
  presetId: string;
  studentName: string;
  courseName: string;
  projectTitle: string;
  taskSummary: string;
  outputSchemaSummary: string;
  dataSourceNote: string;
  labelingRules: string;
  eligibilityConfirmed: {
    narrowRepeatable: boolean;
    easyToFeed: boolean;
    checkableRulesFirst: boolean;
    privacySanitized: boolean;
  };
}

export interface PresenterSessionRecord {
  id: string;
  sessionDate: string;
  drawnNumbers: number[];
  poolSizeBeforeDraw: number;
  excludedCount: number;
  allowRepeat: boolean;
  timestamp: string;
}

export interface AppState {
  meta: ProjectMeta;
  v1: AssistantVersion;
  v2: AssistantVersion;
  testCases: TestCaseRow[];
  processLog: ProcessLogEntry[];
  reflection: ReflectionSections;
  drawConfig: {
    totalStudents: number;
    presentersPerSession: number;
    allowRepeat: boolean;
    sessionDate: string;
  };
  drawHistory: PresenterSessionRecord[];
}
