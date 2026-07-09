import { NextResponse } from "next/server";
import { isGeminiApiError } from "@/lib/ai/gemini-errors";
import { runSectionRefresh } from "@/lib/research/refresh-sections";
import type { RefreshSection } from "@/lib/research/refresh-section-config";

const VALID: RefreshSection[] = [
  "all",
  "financial",
  "leads",
  "marketing",
  "projects",
  "strategy",
  "investment",
  "competitors",
  "ads",
  "sources",
  "api-costs",
];

export async function POST(request: Request) {
  let section: RefreshSection = "all";
  try {
    const body = await request.json().catch(() => ({}));
    if (body.section && VALID.includes(body.section)) {
      section = body.section as RefreshSection;
    }
  } catch {
    /* default all */
  }

  try {
    const result = await runSectionRefresh(section);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (isGeminiApiError(err)) {
      return NextResponse.json(
        { ok: false, error: err.code, message: err.userMessage },
        { status: 503 },
      );
    }
    const message =
      err instanceof Error ? err.message : "Refresh failed";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
