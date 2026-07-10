import { NextResponse } from "next/server";
import { getGeminiStatus } from "@/lib/ai/gemini";

export async function GET() {
  const gemini = await getGeminiStatus();

  return NextResponse.json({
    gemini,
    dataDir: process.env.MARKET_RESEARCH_DATA_DIR ?? "data",
  });
}
