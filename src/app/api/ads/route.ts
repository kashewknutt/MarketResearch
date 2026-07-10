import { NextResponse } from "next/server";
import { purgeExpiredTrash } from "@/lib/research/stages/ad-trends-merge";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdTrendsSnapshot } from "@/lib/types/domain";

export async function GET() {
  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  if (!ads) {
    return NextResponse.json({ ads });
  }

  const purged = purgeExpiredTrash(ads);
  if (purged !== ads) {
    await saveSnapshot("ads", purged);
  }
  return NextResponse.json({ ads: purged });
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
