import { GoogleGenAI } from "@google/genai";
import { getDb } from "@/lib/db/client";
import { aiLogs } from "@/lib/db/schema";
import type { Citation } from "@/lib/types/domain";
import {
  classifyGeminiError,
  GeminiApiError,
  GEMINI_SETUP_MESSAGE,
} from "@/lib/ai/gemini-errors";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import {
  extractUsageFromResponse,
  recordApiCostEvent,
} from "@/lib/ai/cost-tracker";
import { GEMINI_MODEL } from "@/lib/ai/constants";

export const MODEL = GEMINI_MODEL;

export interface GeminiJsonOptions<T> {
  task: string;
  systemInstruction: string;
  userPrompt: string;
  useGoogleSearch?: boolean;
  parse: (raw: unknown) => T;
  trace: AiCallTrace;
}

export interface GeminiResult<T> {
  data: T;
  citations: Citation[];
  rawText: string;
  costEventId: string;
}

export type GeminiConnectionStatus =
  | "ready"
  | "missing_key"
  | "invalid_key"
  | "expired_key"
  | "rate_limited"
  | "billing_required"
  | "credits_depleted"
  | "unavailable";

export interface GeminiStatusPayload {
  status: GeminiConnectionStatus;
  message: string;
  model: string;
}

interface GeminiCallConfig {
  contents: string;
  systemInstruction: string;
  useGoogleSearch?: boolean;
}

type GenerateResponse = Awaited<
  ReturnType<GoogleGenAI["models"]["generateContent"]>
>;

function extractCitations(
  groundingMetadata?: {
    groundingChunks?: Array<{ web?: { title?: string; uri?: string } }>;
  },
): Citation[] {
  const chunks = groundingMetadata?.groundingChunks ?? [];
  return chunks
    .map((c) => ({
      title: c.web?.title ?? "Source",
      uri: c.web?.uri,
    }))
    .filter((c) => c.title || c.uri);
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function assertGeminiKey(): void {
  if (!hasGeminiKey()) {
    throw new GeminiApiError("missing_key", GEMINI_SETUP_MESSAGE);
  }
}

async function executeGeminiCall(
  trace: AiCallTrace,
  config: GeminiCallConfig,
): Promise<{ response: GenerateResponse; costEventId: string }> {
  assertGeminiKey();
  const started = Date.now();
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

  const requestConfig: {
    systemInstruction: string;
    tools?: Array<{ googleSearch: Record<string, never> }>;
  } = {
    systemInstruction: config.systemInstruction,
  };

  if (config.useGoogleSearch) {
    requestConfig.tools = [{ googleSearch: {} }];
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: config.contents,
      config: requestConfig,
    });

    const costEvent = await recordApiCostEvent({
      trace,
      response,
      usedGoogleSearch: Boolean(config.useGoogleSearch),
      success: true,
      durationMs: Date.now() - started,
      promptPreview: config.contents,
    });

    await logAiCall(
      trace.operation,
      config.contents,
      response.text ?? "",
      costEvent.id,
    );

    return { response, costEventId: costEvent.id };
  } catch (err) {
    const classified =
      err instanceof GeminiApiError ? err : classifyGeminiError(err);

    await recordApiCostEvent({
      trace,
      usedGoogleSearch: Boolean(config.useGoogleSearch),
      success: false,
      errorMessage: classified.userMessage,
      durationMs: Date.now() - started,
      promptPreview: config.contents,
    }).catch(() => {});

    throw classified;
  }
}

export async function requireGeminiReady(): Promise<void> {
  await executeGeminiCall(
    {
      operation: "setup.gemini_ping",
      category: "setup",
      researchStage: "connectivity_test",
    },
    {
      contents: 'Respond with JSON only: {"ok":true}',
      systemInstruction: "Reply with valid JSON only.",
    },
  );
}

export async function verifyGeminiConnection(): Promise<GeminiStatusPayload> {
  if (!hasGeminiKey()) {
    return {
      status: "missing_key",
      message: GEMINI_SETUP_MESSAGE,
      model: MODEL,
    };
  }

  try {
    await requireGeminiReady();
    return {
      status: "ready",
      message: "Gemini API is connected.",
      model: MODEL,
    };
  } catch (err) {
    const classified = classifyGeminiError(err);
    return {
      status:
        classified.code === "rate_limited"
          ? "rate_limited"
          : mapCodeToStatus(classified.code),
      message: classified.userMessage,
      model: MODEL,
    };
  }
}

function mapCodeToStatus(
  code: GeminiApiError["code"],
): GeminiConnectionStatus {
  switch (code) {
    case "missing_key":
      return "missing_key";
    case "invalid_key":
      return "invalid_key";
    case "expired_key":
      return "expired_key";
    case "rate_limited":
      return "rate_limited";
    case "billing_required":
      return "billing_required";
    case "credits_depleted":
      return "credits_depleted";
    default:
      return "unavailable";
  }
}

export interface GoogleSearchVerifyResult {
  ok: boolean;
  message: string;
  searchQueries: string[];
  citationsCount: number;
}

export async function verifyGoogleSearchGrounding(): Promise<GoogleSearchVerifyResult> {
  assertGeminiKey();

  try {
    const { response } = await executeGeminiCall(
      {
        operation: "setup.google_search_test",
        category: "setup",
        researchStage: "google_search_test",
      },
      {
        contents:
          'Use Google Search. Reply JSON only: {"ok":true,"note":"search test"}',
        systemInstruction:
          "You must use the Google Search tool. Reply with valid JSON only.",
        useGoogleSearch: true,
      },
    );

    const usage = extractUsageFromResponse(response);
    const meta = response.candidates?.[0]?.groundingMetadata as
      | { groundingChunks?: unknown[] }
      | undefined;
    const citationsCount = meta?.groundingChunks?.length ?? 0;
    const hasGrounding =
      usage.searchQueries.length > 0 || citationsCount > 0;

    if (!hasGrounding) {
      return {
        ok: false,
        message:
          "Google Search grounding did not activate. Enable Grounding with Google Search and billing on your Google Cloud / AI Studio project.",
        searchQueries: [],
        citationsCount: 0,
      };
    }

    return {
      ok: true,
      message: `Google Search is active (${usage.searchQueries.length} queries, ${citationsCount} sources).`,
      searchQueries: usage.searchQueries,
      citationsCount,
    };
  } catch (err) {
    if (err instanceof GeminiApiError) {
      return {
        ok: false,
        message: err.userMessage,
        searchQueries: [],
        citationsCount: 0,
      };
    }
    const classified = classifyGeminiError(err);
    return {
      ok: false,
      message: classified.userMessage,
      searchQueries: [],
      citationsCount: 0,
    };
  }
}

export async function getGeminiStatus(
  verify = false,
): Promise<GeminiStatusPayload> {
  if (!hasGeminiKey()) {
    return {
      status: "missing_key",
      message: GEMINI_SETUP_MESSAGE,
      model: MODEL,
    };
  }

  if (!verify) {
    return {
      status: "ready",
      message: "API key configured. Run research to verify connectivity.",
      model: MODEL,
    };
  }

  const result = await verifyGeminiConnection();
  if (result.status !== "ready") {
    return result;
  }
  return {
    status: "ready",
    message: "Gemini API is connected and ready.",
    model: MODEL,
  };
}

export async function generateStructuredJson<T>(
  options: GeminiJsonOptions<T>,
): Promise<GeminiResult<T>> {
  const { response, costEventId } = await executeGeminiCall(options.trace, {
    contents: options.userPrompt,
    systemInstruction: `${options.systemInstruction}\n\nRespond with valid JSON only. No markdown fences.`,
    useGoogleSearch: options.useGoogleSearch,
  });

  const rawText = response.text ?? "";

  let parsed: unknown;
  try {
    const cleaned = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    throw new GeminiApiError(
      "parse_error",
      "AI returned an unexpected response. Try running research again.",
      `Failed to parse JSON for task: ${options.task}`,
    );
  }

  const citations = extractCitations(
    response.candidates?.[0]?.groundingMetadata as Parameters<
      typeof extractCitations
    >[0],
  );

  return {
    data: options.parse(parsed),
    citations,
    rawText,
    costEventId,
  };
}

async function logAiCall(
  task: string,
  prompt: string,
  response: string,
  costEventId: string,
): Promise<void> {
  const db = getDb();
  await db.insert(aiLogs).values({
    task,
    prompt: prompt.slice(0, 8000),
    response: response.slice(0, 16000),
    costEventId,
    createdAt: new Date().toISOString(),
  });
}
