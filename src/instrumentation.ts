export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { hasGeminiKey, verifyGeminiConnection, setStartupGeminiStatus } = await import(
    "@/lib/ai/gemini"
  );

  if (!hasGeminiKey()) {
    console.warn("[startup] GEMINI_API_KEY not set — research features will be unavailable.");
    return;
  }

  try {
    const result = await verifyGeminiConnection();
    setStartupGeminiStatus(result);
    if (result.status === "ready") {
      console.log("[startup] Gemini API verified and ready.");
    } else {
      console.warn(`[startup] Gemini API check failed: ${result.message}`);
    }
  } catch (err) {
    console.error("[startup] Gemini API verification threw an error:", err);
  }
}
