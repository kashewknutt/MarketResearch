/**
 * How live web research works in this app.
 *
 * We use Gemini "Grounding with Google Search" via the `google_search` tool on
 * generateContent — authenticated only with GEMINI_API_KEY.
 *
 * We do NOT call these (they use OAuth 2.0 / service accounts, not a single API key):
 * - Google Custom Search JSON API (Programmable Search Engine)
 * - Google Search Console API
 */
export const SEARCH_INTEGRATION = {
  method: "gemini_grounding_with_google_search",
  docsUrl: "https://ai.google.dev/gemini-api/docs/google-search",
  requiredEnv: ["GEMINI_API_KEY"] as const,
  notRequired: [
    "Google Custom Search API key or Search Engine ID",
    "Google Search Console API",
    "OAuth 2.0 client ID / client secret (for search)",
    "GCP service account JSON (for search)",
  ] as const,
  summary:
    "Web search runs inside Gemini using the google_search tool. Only GEMINI_API_KEY is required.",
} as const;
