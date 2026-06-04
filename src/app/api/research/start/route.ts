import { NextResponse } from "next/server";
import { isGeminiApiError } from "@/lib/ai/gemini-errors";
import { createAndStartResearchJob } from "@/lib/research/orchestrator";

export async function POST() {
  try {
    const job = await createAndStartResearchJob();
    return NextResponse.json({ job });
  } catch (err) {
    if (isGeminiApiError(err)) {
      return NextResponse.json(
        { error: err.code, message: err.userMessage },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Failed to start research";
    return NextResponse.json({ error: "unavailable", message }, { status: 500 });
  }
}
