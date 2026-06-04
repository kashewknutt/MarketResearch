import { NextResponse } from "next/server";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { MarketingSnapshot } from "@/lib/types/domain";

export async function GET() {
  const marketing = await getSnapshot<MarketingSnapshot>("marketing");
  return NextResponse.json({ marketing });
}

export async function PATCH(request: Request) {
  const existing = await getSnapshot<MarketingSnapshot>("marketing");
  if (!existing) {
    return NextResponse.json({ error: "No data" }, { status: 404 });
  }
  const body = await request.json();
  const updated = {
    ...existing,
    ...body,
    provenance: {
      ...existing.provenance,
      source: "user" as const,
      isUserEdited: true,
    },
  };
  await saveSnapshot("marketing", updated);
  return NextResponse.json({ marketing: updated });
}
