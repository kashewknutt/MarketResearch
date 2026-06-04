export type GeminiErrorCode =
  | "missing_key"
  | "invalid_key"
  | "expired_key"
  | "rate_limited"
  | "billing_required"
  | "parse_error"
  | "unavailable";

export class GeminiApiError extends Error {
  readonly code: GeminiErrorCode;
  readonly userMessage: string;

  constructor(code: GeminiErrorCode, userMessage: string, detail?: string) {
    super(detail ?? userMessage);
    this.name = "GeminiApiError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function isGeminiApiError(err: unknown): err is GeminiApiError {
  return err instanceof GeminiApiError;
}

export function classifyGeminiError(err: unknown): GeminiApiError {
  if (isGeminiApiError(err)) return err;

  const message =
    err instanceof Error ? err.message : String(err ?? "Unknown error");
  const lower = message.toLowerCase();

  if (
    lower.includes("api key") &&
    (lower.includes("invalid") ||
      lower.includes("not valid") ||
      lower.includes("incorrect"))
  ) {
    return new GeminiApiError(
      "invalid_key",
      "Your Gemini API key is invalid. Update GEMINI_API_KEY in .env.local and restart the app.",
      message,
    );
  }

  if (
    lower.includes("expired") ||
    lower.includes("revoked") ||
    lower.includes("disabled")
  ) {
    return new GeminiApiError(
      "expired_key",
      "Your Gemini API key appears expired or revoked. Generate a new key at Google AI Studio.",
      message,
    );
  }

  if (
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("unauthenticated") ||
    lower.includes("permission_denied")
  ) {
    return new GeminiApiError(
      "invalid_key",
      "Gemini rejected the API key. Check GEMINI_API_KEY in .env.local and restart.",
      message,
    );
  }

  if (
    lower.includes("billing") ||
    lower.includes("payment") ||
    lower.includes("enable billing") ||
    lower.includes("quota exceeded") ||
    lower.includes("resource_exhausted") ||
    lower.includes("insufficient") ||
    lower.includes("precondition") ||
    (lower.includes("quota") && lower.includes("exceed"))
  ) {
    return new GeminiApiError(
      "billing_required",
      "Billing or quota must be enabled for Gemini and Google Search grounding. Link a paid Cloud billing account in Google Cloud Console or Google AI Studio, then retry.",
      message,
    );
  }

  if (lower.includes("429") || lower.includes("quota") || lower.includes("rate")) {
    return new GeminiApiError(
      "rate_limited",
      "Gemini rate limit reached. Wait a moment and try again.",
      message,
    );
  }

  if (lower.includes("failed to parse")) {
    return new GeminiApiError(
      "parse_error",
      "AI returned an unexpected response. Try running research again.",
      message,
    );
  }

  return new GeminiApiError(
    "unavailable",
    "Could not reach Gemini. Check your network and API key, then try again.",
    message,
  );
}

export const GEMINI_SETUP_MESSAGE =
  "Add GEMINI_API_KEY to .env.local (get a key at https://aistudio.google.com/apikey), then restart the dev server or desktop app.";
