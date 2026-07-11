import { randomUUID } from "crypto";
import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { createProvenance } from "@/lib/db/provenance";
import { adIdeaSchema, safeParse, trendingAdExampleSchema } from "@/lib/agents/validate";
import {
  buildExampleIndex,
  buildExistingIdeaContext,
  getUnusedExamples,
  getUsedSourceIds,
  resolveIdeaSourceRef,
} from "@/lib/research/stages/ad-idea-sourcing";
import { isEnglishOrHindi } from "@/lib/utils/language";
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

function summarizeUnusedExamples(examples: TrendingAdExample[]): string {
  if (examples.length === 0) return "(none available — research fresh ones)";
  return examples
    .slice(0, 30)
    .map((e) => `- id="${e.id}" "${e.title}" (${e.platform}/${e.format}) — ${e.whyTrending}`)
    .join("\n");
}

export async function generateMoreAdIdeas(
  profile: OnboardingProfile,
  existing: AdTrendsSnapshot,
  count: number,
  jobId: string,
  focus?: GenerateMoreIdeasFocus,
): Promise<{ newIdeas: AdIdea[]; newExamples: TrendingAdExample[] }> {
  const cappedCount = Math.max(1, Math.min(count, 25));
  // 1:1 with requested ideas — used sources are now off the table, so the
  // fresh-research budget can't assume half the ideas can share a source.
  const supportingExampleCount = cappedCount;

  const trace: AiCallTrace = {
    operation: "research.ad_ideas_more",
    category: "research",
    correlationId: jobId,
    researchStage: "ad_trends",
  };

  const usedIds = getUsedSourceIds(existing.ideasForYou);
  const unusedExisting = getUnusedExamples(
    [...existing.trendingNow, ...existing.competitorActivity.flatMap((c) => c.examples)],
    usedIds,
  );

  const existingIdeaContext = buildExistingIdeaContext(existing.ideasForYou);
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
      "Social media and paid-ads trend analyst. Use web search for real, current trending examples. " +
      "Only research/include English or Hindi language content — never Spanish, French, Portuguese, or any " +
      "other language, even if it's highly trending. Every source and idea must be concretely, specifically " +
      "relevant to this exact business and audience — reject generic tech/AI platitudes and vague inspiration " +
      "in favor of specific tactics, hooks, and formats actually used by the source. JSON only.",
    userPrompt: `Business: ${profile.businessName} (${profile.serviceDomain}), targeting ${profile.targetAudience} in ${profile.regions.join(", ")}.
Tracked competitors: ${existing.trackedCompetitors.join(", ") || "none"}

Ideas already generated — do NOT repeat these titles, hooks, or underlying angles, generate genuinely different concepts:
${existingIdeaContext}

Sources already used as inspiration for one of the ideas above have been removed from the list below — the ONLY existing sources you may cite as "exampleId" are these unused ones (in addition to researching fresh ones):
${summarizeUnusedExamples(unusedExisting)}

${focusLine}

Tasks:
1. Research ${supportingExampleCount} additional real, currently-trending ad/content examples (use search grounding) to serve as fresh sources — these become "newExamples". English or Hindi language only — skip anything else entirely. Each "whyTrending" must state a specific, concrete reason (a real tactic, hook, or format choice), never a generic "this is popular" filler. Every example MUST still have a non-empty "engagementSignal" — a specific qualitative performance note from your research — never leave it empty just because you don't have exact numbers.
2. Generate exactly ${cappedCount} new "newIdeas" — concrete, actionable video/post/reel/meme ideas tailored to ${profile.businessName}, each with a genuinely distinct hook and angle from every idea listed above (not just a reworded title). English or Hindi only. **The user needs FAST, cheap-to-produce 30-second ads, not long-form video** — heavily favor "reel", "short", "static_post", "story", "meme", and "ad_creative" formats; only use "long_video" or "carousel" rarely (at most 1-2 in 10) and only when truly necessary. Every "concept" and "scriptOrCaption" must be written assuming a ~30 second runtime — one hook, one point, one call to action. Reject generic AI/SaaS platitudes ("automate your business", "save time with AI") unless tied to a specific, concrete scenario this business's actual audience would recognize — every idea must reference a specific pain point, number, tool, or moment, not a vague category claim. Every idea MUST include a "sourceRef" pointing at EITHER one of the "newExamples" you just researched, OR one of the unused sources listed above (reuse its exact "id" as "exampleId" plus copy its title/url/platform/brandName/engagementSignal) and a concrete "whyPicked" naming the specific tactic being borrowed, not just restating that the source is popular. Never reuse an already-used source's id. If none fit, set "exampleId" to "" and explain the general trend in "whyPicked" instead.

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
    .filter((e): e is TrendingAdExample => e !== null)
    .map((e) => ({ ...e, sourceType: e.sourceType ?? "ai_estimate" }))
    .filter((e) => isEnglishOrHindi(`${e.title} ${e.description} ${e.whyTrending}`));

  // Deliberately excludes used sources — if the model disobeys and cites a
  // used id anyway, it won't resolve to a real match here and falls back to
  // resolveIdeaSourceRef's generic-stub path, so it can't get credit for
  // reusing a source even if it tries.
  const exampleIndex = buildExampleIndex(
    [...newExamples, ...unusedExisting],
    [],
  );

  const existingTitlesLower = new Set(
    existing.ideasForYou.filter((i) => !i.deletedAt).map((i) => i.title.trim().toLowerCase()),
  );

  const newIdeas: AdIdea[] = (result.data.newIdeas ?? [])
    .map((e) => safeParse(adIdeaSchema, withId(e)))
    .filter((e): e is Omit<AdIdea, "provenance" | "status"> => e !== null)
    .filter((e) => !existingTitlesLower.has(e.title.trim().toLowerCase()))
    .filter((e) => isEnglishOrHindi(`${e.title} ${e.hook} ${e.concept}`))
    .slice(0, cappedCount)
    .map((e) => ({
      ...e,
      sourceRef: resolveIdeaSourceRef(e, exampleIndex),
      status: "idea" as const,
      provenance: createProvenance("search", result.citations, 0.7),
    }));

  return { newIdeas, newExamples };
}
