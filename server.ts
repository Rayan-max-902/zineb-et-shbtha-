import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_ID = "gemini-4-hydrogen";

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function generateWithRetry(
  ai: GoogleGenAI,
  systemInstruction: string,
  inputText: string,
  maxAttempts = 3
): Promise<string> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL_ID,
        contents: inputText,
        config: {
          systemInstruction,
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });
      return response.text ?? "";
    } catch (err: unknown) {
      lastError = err;
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? Number((err as { status?: unknown }).status)
          : undefined;
      console.error(`Gemini attempt ${attempt} failed (status=${status}):`, err);
      const isTransient = status === undefined || status >= 500;
      if (!isTransient || attempt === maxAttempts) {
        throw err;
      }
      const delayMs = 350 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, model: MODEL_ID });
  });

  app.post("/api/assistant/run", async (req, res) => {
    const body = req.body as {
      systemInstruction?: unknown;
      inputText?: unknown;
    };

    const systemInstruction =
      typeof body?.systemInstruction === "string"
        ? body.systemInstruction.trim()
        : "";
    const inputText =
      typeof body?.inputText === "string" ? body.inputText.trim() : "";

    if (!systemInstruction) {
      res.status(400).json({
        error: "System instructions are required before running the assistant.",
      });
      return;
    }

    if (!inputText) {
      res.status(400).json({
        error: "Input text is required to test the assistant.",
      });
      return;
    }

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          "GEMINI_API_KEY is not configured in Settings > Secrets. Add your API key to run live assistant tests.",
      });
      return;
    }

    const startedAt = Date.now();
    try {
      const outputText = await generateWithRetry(
        ai,
        systemInstruction,
        inputText
      );
      const latencyMs = Date.now() - startedAt;
      res.json({
        outputText,
        model: MODEL_ID,
        latencyMs,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? Number((err as { status?: unknown }).status)
          : 500;
      const rawMessage =
        err instanceof Error ? err.message : "Failed to run Gemini assistant.";

      let userMessage = rawMessage;
      if (status === 403 || status === 400) {
        if (rawMessage.includes("API_KEY") || rawMessage.includes("PERMISSION")) {
          userMessage =
            "The Gemini API rejected the configured key. Please verify GEMINI_API_KEY in Settings > Secrets.";
        }
      } else if (status === 429) {
        userMessage =
          "Rate limit or quota reached on the Gemini API key. Wait a moment or check quota in Settings > Secrets.";
      }

      res.status(status >= 400 && status < 600 ? status : 500).json({
        error: userMessage,
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      const indexFile = path.join(distPath, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build artifacts not found. Run npm run build first.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`BenchAudit server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
