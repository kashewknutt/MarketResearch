import { NextResponse } from "next/server";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdTrendsSnapshot } from "@/lib/types/domain";

export async function GET() {
  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  return NextResponse.json({ ads });
}

export async function PATCH(request: Request) {
  const existing = await getSnapshot<AdTrendsSnapshot>("ads");
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
  await saveSnapshot("ads", updated);
  return NextResponse.json({ ads: updated });
}
