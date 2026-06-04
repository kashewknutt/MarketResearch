import { NextRequest, NextResponse } from "next/server";
import {
  getCostSummary,
  listCostEvents,
  getPricingSnapshot,
} from "@/lib/ai/cost-tracker";
import { fetchLivePricing } from "@/lib/ai/pricing";

export async function GET(request: NextRequest) {
  const refreshPricing =
    request.nextUrl.searchParams.get("refreshPricing") === "true";

  if (refreshPricing) {
    await fetchLivePricing();
  }

  const summary = await getCostSummary();
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
  const events = await listCostEvents(Math.min(limit, 500));

  const correlationId = request.nextUrl.searchParams.get("correlationId");
  const filtered = correlationId
    ? events.filter((e) => e.correlationId === correlationId)
    : events;

  return NextResponse.json({
    summary,
    events: filtered,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  if (body.action === "refresh_pricing") {
    const pricing = await fetchLivePricing();
    return NextResponse.json({ pricing });
  }

  const snapshotId = body.pricingSnapshotId as string | undefined;
  if (snapshotId) {
    const snapshot = await getPricingSnapshot(snapshotId);
    return NextResponse.json({ snapshot });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
