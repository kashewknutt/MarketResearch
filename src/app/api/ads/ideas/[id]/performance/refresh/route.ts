import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getLinkedInSocialMetadata } from "@/lib/integrations/linkedin-social-metadata";
import { getYoutubeVideoStats } from "@/lib/integrations/youtube";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdTrendsSnapshot, PerformanceSnapshot } from "@/lib/types/domain";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  const idea = ads?.ideasForYou.find((i) => i.id === id);
  if (!ads || !idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const publishInfo = idea.publishInfo;
  if (!publishInfo) {
    return NextResponse.json({ error: "This idea has no publish info yet." }, { status: 400 });
  }

  let snapshot: PerformanceSnapshot | undefined;

  if (publishInfo.platform === "LinkedIn" && publishInfo.linkedInPostUrn) {
    const result = await getLinkedInSocialMetadata(publishInfo.linkedInPostUrn);
    if (result.permissionDenied) {
      return NextResponse.json(
        { error: "linkedin_permission_denied", message: result.message },
        { status: 403 },
      );
    }
    if (!result.ok || !result.metrics) {
      return NextResponse.json({ error: result.message ?? "LinkedIn refresh failed" }, { status: 502 });
    }
    snapshot = {
      id: randomUUID(),
      fetchedAt: new Date().toISOString(),
      source: "linkedin_api",
      metrics: result.metrics,
    };
  } else if (publishInfo.platform === "YouTube" && publishInfo.youtubeVideoId) {
    const metrics = await getYoutubeVideoStats(publishInfo.youtubeVideoId);
    if (!metrics) {
      return NextResponse.json({ error: "YouTube stats fetch failed" }, { status: 502 });
    }
    snapshot = {
      id: randomUUID(),
      fetchedAt: new Date().toISOString(),
      source: "youtube_api",
      metrics,
    };
  } else {
    return NextResponse.json(
      { error: "no_automatic_source", message: "No automatic source for this platform — use manual entry." },
      { status: 400 },
    );
  }

  const fresh = (await getSnapshot<AdTrendsSnapshot>("ads")) ?? ads;
  const updatedIdeas = fresh.ideasForYou.map((i) =>
    i.id === id
      ? { ...i, performanceHistory: [...(i.performanceHistory ?? []), snapshot!] }
      : i,
  );
  const updated: AdTrendsSnapshot = { ...fresh, ideasForYou: updatedIdeas };
  await saveSnapshot("ads", updated);

  return NextResponse.json({ ads: updated, snapshot });
}
