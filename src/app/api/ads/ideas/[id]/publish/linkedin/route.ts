import { NextResponse } from "next/server";
import { createLinkedInTextPost } from "@/lib/integrations/linkedin-posts";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdTrendsSnapshot } from "@/lib/types/domain";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  const idea = ads?.ideasForYou.find((i) => i.id === id);
  if (!ads || !idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const commentary: string | undefined =
    (typeof body.commentary === "string" && body.commentary.trim()) ||
    idea.generatedContent?.captionOrPost ||
    idea.scriptOrCaption;

  if (!commentary) {
    return NextResponse.json(
      { error: "Nothing to publish — generate content first." },
      { status: 400 },
    );
  }

  let postUrn: string;
  try {
    ({ postUrn } = await createLinkedInTextPost(commentary));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const fresh = (await getSnapshot<AdTrendsSnapshot>("ads")) ?? ads;
  const publishedAt = new Date().toISOString();
  const updatedIdeas = fresh.ideasForYou.map((i) =>
    i.id === id
      ? {
          ...i,
          status: "published_linkedin" as const,
          statusUpdatedAt: publishedAt,
          linkedInPublish: { postUrn, publishedAt, commentaryUsed: commentary },
        }
      : i,
  );
  const updated: AdTrendsSnapshot = { ...fresh, ideasForYou: updatedIdeas };
  await saveSnapshot("ads", updated);

  return NextResponse.json({ ads: updated, postUrn });
}
