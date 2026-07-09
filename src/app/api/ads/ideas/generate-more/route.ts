import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { generateMoreAdIdeas } from "@/lib/research/stages/ad-ideas-incremental";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import { getProfile } from "@/lib/store/settings";
import type { AdFormat, AdTrendsSnapshot } from "@/lib/types/domain";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const count = typeof body.count === "number" ? body.count : 10;
  const focus: { format?: AdFormat; competitorName?: string; note?: string } | undefined =
    body.focus ?? undefined;

  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  }

  const existing = await getSnapshot<AdTrendsSnapshot>("ads");
  if (!existing) {
    return NextResponse.json({ error: "Run research first" }, { status: 404 });
  }

  const jobId = randomUUID();
  const { newIdeas, newExamples } = await generateMoreAdIdeas(profile, existing, count, jobId, focus);

  const current = (await getSnapshot<AdTrendsSnapshot>("ads")) ?? existing;
  const updated: AdTrendsSnapshot = {
    ...current,
    trendingNow: [...current.trendingNow, ...newExamples],
    ideasForYou: [...current.ideasForYou, ...newIdeas],
  };
  await saveSnapshot("ads", updated);

  return NextResponse.json({ ads: updated, addedIdeas: newIdeas.length });
}
