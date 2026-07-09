import { NextResponse } from "next/server";
import { buildManualPublishInfo } from "@/lib/research/stages/ad-publish-info";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdIdeaStatus, AdTrendsSnapshot } from "@/lib/types/domain";

const VALID_STATUSES: AdIdeaStatus[] = ["idea", "content_ready", "posted", "published_linkedin"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body.status as AdIdeaStatus;
  const platform = typeof body.platform === "string" ? body.platform : undefined;
  const url = typeof body.url === "string" ? body.url : undefined;

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  if (!ads?.ideasForYou.some((i) => i.id === id)) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const fresh = (await getSnapshot<AdTrendsSnapshot>("ads")) ?? ads;
  const statusUpdatedAt = new Date().toISOString();
  const updatedIdeas = fresh.ideasForYou.map((i) => {
    if (i.id !== id) return i;
    const publishInfo =
      status === "posted" && platform ? buildManualPublishInfo(platform, url) : i.publishInfo;
    return { ...i, status, statusUpdatedAt, publishInfo };
  });
  const updated: AdTrendsSnapshot = { ...fresh, ideasForYou: updatedIdeas };
  await saveSnapshot("ads", updated);

  return NextResponse.json({ ads: updated });
}
