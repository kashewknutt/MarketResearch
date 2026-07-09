import { randomUUID } from "crypto";
import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { createProvenance } from "@/lib/db/provenance";
import { adIdeaSchema, safeParse, trendingAdExampleSchema } from "@/lib/agents/validate";
import { buildExampleIndex, resolveIdeaSourceRef } from "@/lib/research/stages/ad-idea-sourcing";
import type {
  AdFormat,
  AdIdea,
  AdTrendsSnapshot,
  OnboardingProfile,
  TrendingAdExample,
} from "@/lib/types/domain";

export interface GenerateMoreIdeasFocus {
  format?: AdFormat;
  competitorName?: string;
  note?: string;
}

export async function generateMoreAdIdeas(
  profile: OnboardingProfile,
  existing: AdTrendsSnapshot,
  count: number,
  jobId: string,
  focus?: GenerateMoreIdeasFocus,
): Promise<{ newIdeas: AdIdea[]; newExamples: TrendingAdExample[] }> {
  const cappedCount = Math.max(1, Math.min(count, 25));
  const supportingExampleCount = Math.max(2, Math.ceil(cappedCount / 2));

  const trace: AiCallTrace = {
    operation: "research.ad_ideas_more",
    category: "research",
    correlationId: jobId,
    researchStage: "ad_trends",
  };

  const existingTitles = existing.ideasForYou.map((i) => i.title).slice(0, 60);
  const focusLine = [
    focus?.format ? `Focus format: ${focus.format}.` : "",
    focus?.competitorName ? `Focus competitor: ${focus.competitorName}.` : "",
    focus?.note ? `Additional direction from user: ${focus.note}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const result = await generateStructuredJson<{
    newExamples: Array<Record<string, unknown>>;
    newIdeas: Array<Record<string, unknown>>;
  }>({
    task: "ad_ideas_more",
    systemInstruction:
      "Social media and paid-ads trend analyst. Use web search for real, current trending examples. JSON only.",
    userPrompt: `Business: ${profile.businessName} (${profile.serviceDomain}), targeting ${profile.targetAudience} in ${profile.regions.join(", ")}.
Tracked competitors: ${existing.trackedCompetitors.join(", ") || "none"}

Ideas already generated (do NOT repeat these, generate genuinely different ones):
${existingTitles.map((t) => `- ${t}`).join("\n") || "(none yet)"}

${focusLine}

Tasks:
1. Research ${supportingExampleCount} additional real, currently-trending ad/content examples (use search grounding) to serve as fresh sources — these become "newExamples".
2. Generate exactly ${cappedCount} new "newIdeas" — concrete, actionable video/post/reel/meme ideas tailored to ${profile.businessName}, distinct from the existing titles above. Every idea MUST include a "sourceRef" pointing at one of the "newExamples" you just researched (reuse its exact "id" as "exampleId" plus copy its title/url/platform/brandName/engagementSignal) and a concrete "whyPicked". If none fit, set "exampleId" to "" and explain the general trend in "whyPicked" instead.

Return JSON:
{
  "newExamples": [{
    "id": string, "platform": string, "brandName": string, "isOwnBrand": boolean,
    "format": "reel"|"short"|"meme"|"static_post"|"carousel"|"long_video"|"story"|"ad_creative",
    "title": string, "description": string, "whyTrending": string, "hook": string,
    "engagementSignal": string, "url": string, "publishedAt": string,
    "citations": [{ "title": string, "uri": string }]
  }],
  "newIdeas": [{
    "id": string, "platform": string,
    "format": "reel"|"short"|"meme"|"static_post"|"carousel"|"long_video"|"story"|"ad_creative",
    "title": string, "hook": string, "concept": string, "scriptOrCaption": string,
    "whyThisWorks": string, "inspiredBy": string,
    "sourceRef": {
      "exampleId": string, "title": string, "url": string, "platform": string,
      "brandName": string, "engagementSignal": string, "whyPicked": string
    },
    "priority": "high"|"medium"|"low"
  }]
}`,
    useGoogleSearch: true,
    parse: (raw) =>
      raw as { newExamples: Array<Record<string, unknown>>; newIdeas: Array<Record<string, unknown>> },
    trace,
  });

  const withId = (item: Record<string, unknown>) => ({ id: randomUUID(), ...item });

  const newExamples: TrendingAdExample[] = (result.data.newExamples ?? [])
    .map((e) => safeParse(trendingAdExampleSchema, withId(e)))
    .filter((e): e is TrendingAdExample => e !== null);

  const exampleIndex = buildExampleIndex(
    [...existing.trendingNow, ...newExamples],
    existing.competitorActivity,
  );

  const newIdeas: AdIdea[] = (result.data.newIdeas ?? [])
    .map((e) => safeParse(adIdeaSchema, withId(e)))
    .filter((e): e is Omit<AdIdea, "provenance" | "status"> => e !== null)
    .slice(0, cappedCount)
    .map((e) => ({
      ...e,
      sourceRef: resolveIdeaSourceRef(e, exampleIndex),
      status: "idea" as const,
      provenance: createProvenance("search", result.citations, 0.7),
    }));

  return { newIdeas, newExamples };
}
