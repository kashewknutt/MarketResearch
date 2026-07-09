import { randomUUID } from "crypto";
import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { createProvenance } from "@/lib/db/provenance";
import {
  adIdeaSchema,
  competitorAdActivitySchema,
  safeParse,
  trendingAdExampleSchema,
} from "@/lib/agents/validate";
import { searchChannelVideos, searchTrendingVideos } from "@/lib/integrations/youtube";
import type { YoutubeVideoSignal } from "@/lib/integrations/youtube";
import { buildExampleIndex, resolveIdeaSourceRef } from "@/lib/research/stages/ad-idea-sourcing";
import type {
  AdIdea,
  AdTrendsSnapshot,
  CompetitorAdActivity,
  CompetitorSnapshot,
  OnboardingProfile,
  TrendingAdExample,
} from "@/lib/types/domain";

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

function summarizeVideos(label: string, videos: YoutubeVideoSignal[]): string {
  if (videos.length === 0) return `${label}: no YouTube data available.`;
  const lines = videos
    .slice(0, 6)
    .map(
      (v) =>
        `- "${v.title}" by ${v.channelTitle} (${v.viewCount ?? "?"} views, ${v.likeCount ?? "?"} likes) — ${v.url}`,
    )
    .join("\n");
  return `${label}:\n${lines}`;
}

export async function runAdTrends(
  profile: OnboardingProfile,
  competitors: CompetitorSnapshot | null,
  jobId: string,
  existingTrackedCompetitors?: string[],
): Promise<AdTrendsSnapshot> {
  const trace: AiCallTrace = {
    operation: "research.ad_trends",
    category: "research",
    correlationId: jobId,
    researchStage: "ad_trends",
  };

  const trackedCompetitors =
    existingTrackedCompetitors ?? competitors?.competitors.map((c) => c.name) ?? [];

  const [ownVideos, marketVideos, ...competitorVideoLists] = await runWithConcurrency(
    [
      () => searchChannelVideos(profile.businessName),
      () => searchTrendingVideos(`${profile.serviceDomain} ${profile.targetAudience} ads`),
      ...trackedCompetitors.map((name) => () => searchChannelVideos(name)),
    ],
    4,
  );

  const youtubeContext = [
    summarizeVideos(`${profile.businessName} (your brand)`, ownVideos ?? []),
    summarizeVideos("Market-wide trending videos", marketVideos ?? []),
    ...trackedCompetitors.map((name, i) => summarizeVideos(name, competitorVideoLists[i] ?? [])),
  ].join("\n\n");

  const result = await generateStructuredJson<{
    trendingNow: Array<Record<string, unknown>>;
    ideasForYou: Array<Record<string, unknown>>;
    competitorActivity: Array<Record<string, unknown>>;
    discoveredCompetitors: string[];
  }>({
    task: "ad_trends",
    systemInstruction:
      "Social media and paid-ads trend analyst. Use web search for LinkedIn and Instagram trends " +
      "(no official API is available for those). Use the provided YouTube data as ground truth for " +
      "YouTube trends, but qualify, categorize, and enrich it — don't just repeat it. JSON only.",
    userPrompt: `Business: ${profile.businessName} (${profile.serviceDomain}), targeting ${profile.targetAudience} in ${profile.regions.join(", ")}.
Tracked competitors: ${trackedCompetitors.join(", ") || "none provided"}

Real YouTube data pulled via the YouTube Data API:
${youtubeContext}

Tasks:
1. Research trending ad/content formats on LinkedIn and Instagram right now (use search grounding), and combine with the YouTube data above to build "trendingNow": a mixed feed of at least 15 concrete trending examples (own brand, competitors, and other relevant third-party brands/creators), tagging each with a format.
2. Categorize and enrich the YouTube data: assign a format, write why each is trending, extract a hook where possible.
3. Group competitor-specific findings into "competitorActivity", one entry per tracked competitor name plus any other relevant brand you find. Include at least 5 examples per competitor where evidence exists.
4. Identify brand/account names relevant to this market that are NOT in the tracked competitor list and flag them as "discoveredCompetitors".
5. Generate "ideasForYou": at least 20 concrete, actionable ideas tailored to ${profile.businessName}, spanning a spread of formats (reel/short/meme/static_post/carousel/long_video/story/ad_creative) and priorities — do not concentrate on one format. Every idea MUST include a "sourceRef" pointing at one specific entry from "trendingNow" or a competitor's "examples" (reuse its exact "id" as "exampleId", plus copy its title/url/platform/brandName/engagementSignal) and a concrete "whyPicked" explaining exactly why that example justifies this idea. If genuinely no single example inspired it, set "exampleId" to "" and explain in "whyPicked" what general trend justifies it instead — never leave "whyPicked" generic or empty.

Return JSON:
{
  "trendingNow": [{
    "id": string, "platform": string, "brandName": string, "isOwnBrand": boolean,
    "format": "reel"|"short"|"meme"|"static_post"|"carousel"|"long_video"|"story"|"ad_creative",
    "title": string, "description": string, "whyTrending": string, "hook": string,
    "engagementSignal": string, "url": string, "publishedAt": string,
    "citations": [{ "title": string, "uri": string }]
  }],
  "ideasForYou": [{
    "id": string, "platform": string,
    "format": "reel"|"short"|"meme"|"static_post"|"carousel"|"long_video"|"story"|"ad_creative",
    "title": string, "hook": string, "concept": string, "scriptOrCaption": string,
    "whyThisWorks": string, "inspiredBy": string,
    "sourceRef": {
      "exampleId": string, "title": string, "url": string, "platform": string,
      "brandName": string, "engagementSignal": string, "whyPicked": string
    },
    "priority": "high"|"medium"|"low"
  }],
  "competitorActivity": [{
    "competitorName": string, "isDiscovered": boolean,
    "examples": [/* same shape as trendingNow entries */]
  }],
  "discoveredCompetitors": string[]
}`,
    useGoogleSearch: true,
    parse: (raw) =>
      raw as {
        trendingNow: Array<Record<string, unknown>>;
        ideasForYou: Array<Record<string, unknown>>;
        competitorActivity: Array<Record<string, unknown>>;
        discoveredCompetitors: string[];
      },
    trace,
  });

  const withId = (item: Record<string, unknown>) => ({ id: randomUUID(), ...item });

  const trendingNow: TrendingAdExample[] = (result.data.trendingNow ?? [])
    .map((e) => safeParse(trendingAdExampleSchema, withId(e)))
    .filter((e): e is TrendingAdExample => e !== null);

  const competitorActivity: CompetitorAdActivity[] = (result.data.competitorActivity ?? [])
    .map((e) =>
      safeParse(competitorAdActivitySchema, {
        ...e,
        examples: Array.isArray(e.examples) ? e.examples.map((ex) => withId(ex as Record<string, unknown>)) : [],
      }),
    )
    .filter((e): e is CompetitorAdActivity => e !== null);

  const exampleIndex = buildExampleIndex(trendingNow, competitorActivity);

  const ideasForYou: AdIdea[] = (result.data.ideasForYou ?? [])
    .map((e) => safeParse(adIdeaSchema, withId(e)))
    .filter((e): e is Omit<AdIdea, "provenance" | "status"> => e !== null)
    .map((e) => ({
      ...e,
      sourceRef: resolveIdeaSourceRef(e, exampleIndex),
      status: "idea" as const,
      provenance: createProvenance("search", result.citations, 0.7),
    }));

  return {
    trackedCompetitors,
    discoveredCompetitors: result.data.discoveredCompetitors ?? [],
    trendingNow,
    ideasForYou,
    competitorActivity,
    provenance: createProvenance("search", result.citations, 0.75),
  };
}
