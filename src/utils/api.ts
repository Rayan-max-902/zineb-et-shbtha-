export interface RunAssistantResponse {
  outputText: string;
  model: string;
  latencyMs: number;
  timestamp: string;
}

export async function runAssistantOnServer(
  systemInstruction: string,
  inputText: string
): Promise<RunAssistantResponse> {
  const res = await fetch("/api/assistant/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction,
      inputText,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Partial<
    RunAssistantResponse & { error?: string }
  >;

  if (!res.ok) {
    throw new Error(
      data.error || `Assistant execution failed (HTTP ${res.status}).`
    );
  }

  return {
    outputText: data.outputText ?? "",
    model: data.model ?? "gemini-4-hydrogen",
    latencyMs: data.latencyMs ?? 0,
    timestamp: data.timestamp ?? new Date().toISOString(),
  };
}
