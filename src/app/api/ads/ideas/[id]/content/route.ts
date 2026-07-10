import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isGeminiApiError } from "@/lib/ai/gemini-errors";
import { generateIdeaContent } from "@/lib/research/stages/ad-content-generation";
import { getProfile } from "@/lib/store/settings";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdCreativeConstraints, AdTrendsSnapshot } from "@/lib/types/domain";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const notes = typeof body.notes === "string" ? body.notes : "";
  const timeOfDay = typeof body.timeOfDay === "string" && body.timeOfDay ? body.timeOfDay : undefined;

  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 400 });
  }

  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  const idea = ads?.ideasForYou.find((i) => i.id === id);
  if (!ads || !idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const constraints: AdCreativeConstraints = { notes, timeOfDay, updatedAt: new Date().toISOString() };
  const jobId = randomUUID();

  try {
    const generated = await generateIdeaContent(profile, idea, constraints, jobId);
    generated.version = (idea.generatedContent?.version ?? 0) + 1;

    const fresh = (await getSnapshot<AdTrendsSnapshot>("ads")) ?? ads;
    const updatedIdeas = fresh.ideasForYou.map((i) => {
      if (i.id !== id) return i;
      const history = i.generatedContent
        ? [...(i.generatedContentHistory ?? []), i.generatedContent]
        : (i.generatedContentHistory ?? []);
      return {
        ...i,
        generatedContent: generated,
        generatedContentHistory: history,
        status: i.status === "idea" ? ("content_ready" as const) : i.status,
      };
    });
    const updated: AdTrendsSnapshot = { ...fresh, ideasForYou: updatedIdeas };
    await saveSnapshot("ads", updated);

    return NextResponse.json({ ads: updated, idea: updatedIdeas.find((i) => i.id === id) });
  } catch (err) {
    if (isGeminiApiError(err)) {
      return NextResponse.json(
        { error: err.code, message: err.userMessage },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : "Content generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
