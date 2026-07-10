import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createProvenance } from "@/lib/db/provenance";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdIdea, AdTrendsSnapshot } from "@/lib/types/domain";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const exampleId = typeof body.exampleId === "string" ? body.exampleId : "";
  if (!exampleId) {
    return NextResponse.json({ error: "exampleId is required" }, { status: 400 });
  }

  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  const example = ads?.trendingNow.find((e) => e.id === exampleId);
  if (!ads || !example) {
    return NextResponse.json({ error: "Trending example not found" }, { status: 404 });
  }

  const idea: AdIdea = {
    id: randomUUID(),
    platform: example.platform,
    format: example.format,
    title: example.title,
    hook: example.hook ?? example.title,
    concept: example.description,
    scriptOrCaption: "",
    whyThisWorks: example.whyTrending,
    sourceRef: {
      exampleId: example.id,
      title: example.title,
      url: example.url,
      platform: example.platform,
      brandName: example.brandName,
      engagementSignal: example.engagementSignal,
      metrics: example.metrics,
      sourceType: example.sourceType,
      fetchedAt: example.fetchedAt,
      whyPicked: example.whyTrending,
    },
    priority: "medium",
    provenance: createProvenance(
      example.sourceType === "scraped" ? "search" : "ai",
      [],
      example.sourceType === "scraped" ? 0.8 : 0.6,
    ),
    status: "idea",
  };

  const updated: AdTrendsSnapshot = { ...ads, ideasForYou: [...ads.ideasForYou, idea] };
  await saveSnapshot("ads", updated);

  return NextResponse.json({ ads: updated, idea });
}
