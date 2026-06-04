import { NextRequest, NextResponse } from "next/server";
import { getGeminiStatus } from "@/lib/ai/gemini";

export async function GET(request: NextRequest) {
  const verify = request.nextUrl.searchParams.get("verify") === "true";
  const gemini = await getGeminiStatus(verify);

  return NextResponse.json({
    gemini,
    dataDir: process.env.MARKET_RESEARCH_DATA_DIR ?? "data",
  });
}
