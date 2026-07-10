import { NextResponse } from "next/server";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdTrendsSnapshot } from "@/lib/types/domain";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  if (!ads?.ideasForYou.some((i) => i.id === id)) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const updated: AdTrendsSnapshot = {
    ...ads,
    ideasForYou: ads.ideasForYou.map((i) => (i.id === id ? { ...i, deletedAt: undefined } : i)),
  };
  await saveSnapshot("ads", updated);

  return NextResponse.json({ ads: updated });
}
