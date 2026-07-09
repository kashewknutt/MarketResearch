import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdTrendsSnapshot, PerformanceSnapshot } from "@/lib/types/domain";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  if (!ads?.ideasForYou.some((i) => i.id === id)) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const toNumber = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

  const snapshot: PerformanceSnapshot = {
    id: randomUUID(),
    fetchedAt: new Date().toISOString(),
    source: "manual",
    metrics: {
      viewCount: toNumber(body.viewCount),
      likeCount: toNumber(body.likeCount),
      commentCount: toNumber(body.commentCount),
      shareCount: toNumber(body.shareCount),
    },
    note: typeof body.note === "string" ? body.note : undefined,
  };

  const fresh = (await getSnapshot<AdTrendsSnapshot>("ads")) ?? ads;
  const updatedIdeas = fresh.ideasForYou.map((i) =>
    i.id === id
      ? { ...i, performanceHistory: [...(i.performanceHistory ?? []), snapshot] }
      : i,
  );
  const updated: AdTrendsSnapshot = { ...fresh, ideasForYou: updatedIdeas };
  await saveSnapshot("ads", updated);

  return NextResponse.json({ ads: updated, snapshot });
}
