export type GeminiErrorCode =
  | "missing_key"
  | "invalid_key"
  | "expired_key"
  | "rate_limited"
  | "billing_required"
  | "credits_depleted"
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
    lower.includes("prepayment") ||
    lower.includes("prepaid") ||
    (lower.includes("credit") &&
      (lower.includes("deplet") ||
        lower.includes("exhaust") ||
        lower.includes("insufficient")))
  ) {
    return new GeminiApiError(
      "credits_depleted",
      "Your Gemini prepaid credits are used up. Add funds in Google AI Studio (Projects → Billing) or switch to pay-as-you-go, then retry.",
      message,
    );
  }

  if (
    lower.includes("enable billing") ||
    lower.includes("billing account") ||
    lower.includes("billing must be") ||
    lower.includes("billing is not") ||
    lower.includes("billing not enabled")
  ) {
    return new GeminiApiError(
      "billing_required",
      "Billing must be enabled for Gemini and Google Search grounding. Link a paid Cloud billing account in Google Cloud Console or Google AI Studio, then retry.",
      message,
    );
  }

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate") ||
    lower.includes("resource_exhausted")
  ) {
    return new GeminiApiError(
      "rate_limited",
      "Gemini rate limit or quota reached. Wait a moment, check usage in AI Studio, and try again.",
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
