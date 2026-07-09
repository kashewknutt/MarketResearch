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
import {
  apifyEnvPresence,
} from "@/lib/integrations/apify";
import {
  fetchTrendingVideosViaApify,
  searchChannelVideos,
  searchTrendingVideos,
  youtubeEnvPresence,
} from "@/lib/integrations/youtube";
import type { YoutubeVideoSignal } from "@/lib/integrations/youtube";
import {
  fetchInstagramHashtagPosts,
  fetchInstagramProfilePosts,
} from "@/lib/integrations/instagram";
import type { InstagramPostSignal } from "@/lib/integrations/instagram";
import {
  fetchLinkedInAuthorPosts,
  fetchLinkedInKeywordPosts,
} from "@/lib/integrations/linkedin-content-scraper";
import type { LinkedInPostSignal } from "@/lib/integrations/linkedin-content-scraper";
import { buildExampleIndex, resolveIdeaSourceRef } from "@/lib/research/stages/ad-idea-sourcing";
import type {
  AdIdea,
  AdTrendsSnapshot,
  CompetitorAdActivity,
  CompetitorSnapshot,
  CompetitorSocialHandle,
  EngagementMetrics,
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

function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function formatEngagementSignal(metrics: EngagementMetrics): string {
  const parts: string[] = [];
  if (metrics.viewCount != null) parts.push(`${formatCompactNumber(metrics.viewCount)} views`);
  if (metrics.likeCount != null) parts.push(`${formatCompactNumber(metrics.likeCount)} likes`);
  if (metrics.commentCount != null) parts.push(`${formatCompactNumber(metrics.commentCount)} comments`);
  if (metrics.shareCount != null) parts.push(`${formatCompactNumber(metrics.shareCount)} shares`);
  return parts.join(" · ") || "Engagement data unavailable";
}

/** Classifies by real duration (contentDetails.duration) — never guesses "long_video" blind. */
function classifyYoutubeFormat(v: YoutubeVideoSignal): "short" | "long_video" {
  if (v.durationSeconds != null) return v.durationSeconds <= 60 ? "short" : "long_video";
  return "long_video";
}

function youtubeToExample(v: YoutubeVideoSignal, isOwnBrand: boolean): TrendingAdExample {
  const metrics: EngagementMetrics = {
    viewCount: v.viewCount,
    likeCount: v.likeCount,
    commentCount: v.commentCount,
  };
  return {
    id: randomUUID(),
    platform: "YouTube",
    brandName: v.channelTitle || (isOwnBrand ? "Your brand" : "Unknown"),
    isOwnBrand,
    format: classifyYoutubeFormat(v),
    title: v.title,
    description: v.description.slice(0, 300),
    whyTrending: "",
    engagementSignal: formatEngagementSignal(metrics),
    metrics,
    sourceType: "scraped",
    fetchedAt: new Date().toISOString(),
    url: v.url,
    thumbnailUrl: v.thumbnailUrl,
    publishedAt: v.publishedAt,
    citations: [{ title: v.title, uri: v.url }],
  };
}

function instagramToExample(p: InstagramPostSignal, isOwnBrand: boolean): TrendingAdExample {
  const metrics: EngagementMetrics = {
    viewCount: p.viewCount,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
  };
  return {
    id: randomUUID(),
    platform: "Instagram",
    brandName: p.ownerUsername || (isOwnBrand ? "Your brand" : "Unknown"),
    isOwnBrand,
    format: p.mediaType === "Video" ? "reel" : p.mediaType === "Sidecar" ? "carousel" : "static_post",
    title: p.caption.slice(0, 80) || "Instagram post",
    description: p.caption.slice(0, 300),
    whyTrending: "",
    engagementSignal: formatEngagementSignal(metrics),
    metrics,
    sourceType: "scraped",
    fetchedAt: new Date().toISOString(),
    url: p.url,
    publishedAt: p.timestamp,
    citations: [{ title: "Instagram post", uri: p.url }],
  };
}

function linkedinToExample(p: LinkedInPostSignal, isOwnBrand: boolean): TrendingAdExample {
  const metrics: EngagementMetrics = {
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    shareCount: p.shareCount,
  };
  return {
    id: randomUUID(),
    platform: "LinkedIn",
    brandName: p.authorName || (isOwnBrand ? "Your brand" : "Unknown"),
    isOwnBrand,
    format: "static_post",
    title: p.content.slice(0, 80) || "LinkedIn post",
    description: p.content.slice(0, 300),
    whyTrending: "",
    engagementSignal: formatEngagementSignal(metrics),
    metrics,
    sourceType: "scraped",
    fetchedAt: new Date().toISOString(),
    url: p.url,
    publishedAt: p.postedAt,
    citations: [{ title: "LinkedIn post", uri: p.url }],
  };
}

async function getYoutubeSignals(query: string, isChannelSearch: boolean): Promise<YoutubeVideoSignal[]> {
  if (youtubeEnvPresence()) {
    return isChannelSearch ? searchChannelVideos(query) : searchTrendingVideos(query);
  }
  if (apifyEnvPresence()) {
    return fetchTrendingVideosViaApify(query);
  }
  return [];
}

/**
 * Hashtag/keyword-based "market" discovery surfaces recent posts, not curated top posts,
 * so it's noisy — this keeps only the highest-engagement results from a larger raw fetch
 * instead of trusting whatever a generic tag returns at face value.
 */
function topByEngagement<T extends { likeCount?: number; commentCount?: number }>(
  items: T[],
  limit: number,
): T[] {
  return [...items]
    .sort(
      (a, b) => (b.likeCount ?? 0) + (b.commentCount ?? 0) - ((a.likeCount ?? 0) + (a.commentCount ?? 0)),
    )
    .slice(0, limit);
}

function extractInstagramUsername(url?: string): string | undefined {
  if (!url) return undefined;
  return url.match(/instagram\.com\/([^/?]+)/i)?.[1];
}

function resolveOwnSocialUrl(profile: OnboardingProfile, platformMatch: RegExp): string | undefined {
  return profile.socialLinks?.find((l) => platformMatch.test(l.platform))?.url;
}

function summarizeRealExamples(label: string, examples: TrendingAdExample[]): string {
  if (examples.length === 0) return `${label}: no real data available.`;
  const lines = examples
    .slice(0, 10)
    .map(
      (e) =>
        `- id="${e.id}" [${e.platform}] "${e.title}" by ${e.brandName} (${e.engagementSignal}) — ${e.url}`,
    )
    .join("\n");
  return `${label}:\n${lines}`;
}

/** Ensures every real (scraped) example survives even if the model drops it from its response. */
function mergeMissingReal(parsed: TrendingAdExample[], real: TrendingAdExample[]): TrendingAdExample[] {
  const presentIds = new Set(parsed.map((e) => e.id));
  const missing = real
    .filter((e) => !presentIds.has(e.id))
    .map((e) => ({
      ...e,
      whyTrending:
        e.whyTrending || "Directly observed on the tracked account/search — real engagement data.",
    }));
  return [...parsed, ...missing];
}

/** Force-overwrites metrics/url/sourceType on any parsed example matching a real one, by id. */
function reassertReal(examples: TrendingAdExample[], realById: Map<string, TrendingAdExample>): TrendingAdExample[] {
  return examples.map((ex) => {
    const real = realById.get(ex.id);
    if (!real) return ex;
    return {
      ...ex,
      url: real.url,
      metrics: real.metrics,
      sourceType: real.sourceType,
      fetchedAt: real.fetchedAt,
      engagementSignal: real.engagementSignal,
    };
  });
}

export async function runAdTrends(
  profile: OnboardingProfile,
  competitors: CompetitorSnapshot | null,
  jobId: string,
  existingTrackedCompetitors?: string[],
  existingCompetitorSocialHandles?: CompetitorSocialHandle[],
): Promise<AdTrendsSnapshot> {
  const trace: AiCallTrace = {
    operation: "research.ad_trends",
    category: "research",
    correlationId: jobId,
    researchStage: "ad_trends",
  };

  const trackedCompetitors =
    existingTrackedCompetitors ?? competitors?.competitors.map((c) => c.name) ?? [];
  const competitorSocialHandles = existingCompetitorSocialHandles ?? [];
  const handleFor = (name: string) => competitorSocialHandles.find((h) => h.competitorName === name);

  const ownInstagramHandle = extractInstagramUsername(resolveOwnSocialUrl(profile, /instagram/i));
  const ownLinkedinUrl = resolveOwnSocialUrl(profile, /linkedin/i);
  // A compound, multi-word tag is far more specific/relevant than a single generic word —
  // a single word like "software" returns near-random recent posts from unrelated accounts.
  const hashtagGuess =
    profile.serviceDomain
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .slice(0, 3)
      .join("")
      .toLowerCase() || profile.businessName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  const marketKeyword = `${profile.serviceDomain} ${profile.targetAudience}`;

  const [ownYoutube, marketYoutube, ...competitorYoutube] = await runWithConcurrency(
    [
      () => getYoutubeSignals(profile.businessName, true),
      () => getYoutubeSignals(`${marketKeyword} ads`, false),
      ...trackedCompetitors.map((name) => () => getYoutubeSignals(name, true)),
    ],
    4,
  );

  const [ownInstagram, marketInstagramRaw, ...competitorInstagram] = await runWithConcurrency(
    [
      () => (ownInstagramHandle ? fetchInstagramProfilePosts(ownInstagramHandle) : Promise.resolve([])),
      () => fetchInstagramHashtagPosts(hashtagGuess, 24),
      ...trackedCompetitors.map((name) => {
        const handle = handleFor(name)?.instagramHandle;
        return () => (handle ? fetchInstagramProfilePosts(handle) : Promise.resolve([]));
      }),
    ],
    4,
  );
  const marketInstagram = topByEngagement(marketInstagramRaw, 8);

  const [ownLinkedin, marketLinkedinRaw, ...competitorLinkedin] = await runWithConcurrency(
    [
      () =>
        ownLinkedinUrl ? fetchLinkedInAuthorPosts(ownLinkedinUrl, profile.businessName) : Promise.resolve([]),
      () => fetchLinkedInKeywordPosts(marketKeyword, 16),
      ...trackedCompetitors.map((name) => {
        const url = handleFor(name)?.linkedinUrl;
        return () => (url ? fetchLinkedInAuthorPosts(url, name) : Promise.resolve([]));
      }),
    ],
    4,
  );
  const marketLinkedin = topByEngagement(marketLinkedinRaw, 8);

  const realTrendingExamples: TrendingAdExample[] = [
    ...ownYoutube.map((v) => youtubeToExample(v, true)),
    ...marketYoutube.map((v) => youtubeToExample(v, false)),
    ...ownInstagram.map((p) => instagramToExample(p, true)),
    ...marketInstagram.map((p) => instagramToExample(p, false)),
    ...ownLinkedin.map((p) => linkedinToExample(p, true)),
    ...marketLinkedin.map((p) => linkedinToExample(p, false)),
  ];

  const realCompetitorExamples: Record<string, TrendingAdExample[]> = {};
  trackedCompetitors.forEach((name, i) => {
    const examples = [
      ...(competitorYoutube[i] ?? []).map((v) => youtubeToExample(v, false)),
      ...(competitorInstagram[i] ?? []).map((p) => instagramToExample(p, false)),
      ...(competitorLinkedin[i] ?? []).map((p) => linkedinToExample(p, false)),
    ];
    if (examples.length > 0) realCompetitorExamples[name] = examples;
  });

  const realById = new Map<string, TrendingAdExample>();
  for (const ex of realTrendingExamples) realById.set(ex.id, ex);
  for (const list of Object.values(realCompetitorExamples)) for (const ex of list) realById.set(ex.id, ex);

  const realDataContext = [
    summarizeRealExamples(`${profile.businessName} + market-wide real scraped data`, realTrendingExamples),
    ...Object.entries(realCompetitorExamples).map(([name, examples]) =>
      summarizeRealExamples(`${name} (real scraped data)`, examples),
    ),
  ].join("\n\n");

  const result = await generateStructuredJson<{
    trendingNow: Array<Record<string, unknown>>;
    ideasForYou: Array<Record<string, unknown>>;
    competitorActivity: Array<Record<string, unknown>>;
    discoveredCompetitors: string[];
  }>({
    task: "ad_trends",
    systemInstruction:
      "Social media and paid-ads trend analyst. You are given REAL, already-scraped examples (each with a fixed " +
      "\"id=\") from YouTube/Instagram/LinkedIn — for these, reuse the exact same id and ONLY add/improve " +
      "format/whyTrending/hook/title/description. Never invent or alter their engagement numbers or URLs. " +
      "Separately, use web search to research ADDITIONAL trending examples where real data is thin — mark those " +
      "with \"sourceType\": \"ai_estimate\" and omit \"metrics\" entirely (do not fabricate numbers). JSON only.",
    userPrompt: `Business: ${profile.businessName} (${profile.serviceDomain}), targeting ${profile.targetAudience} in ${profile.regions.join(", ")}.
Tracked competitors: ${trackedCompetitors.join(", ") || "none provided"}

Real, already-scraped data (reuse these exact ids, never alter their numbers/urls):
${realDataContext}

Tasks:
1. Build "trendingNow": include every real example above (same id, enriched with format/whyTrending/hook), plus additional AI-researched examples (search grounding) to reach at least 15 total — those get "sourceType": "ai_estimate" and no "metrics".
2. Group competitor-specific findings into "competitorActivity", one entry per tracked competitor name (include their real examples above under that name, enriched) plus any other relevant brand you find. Include at least 5 examples per competitor where evidence exists (real or AI-estimated).
3. Identify brand/account names relevant to this market that are NOT in the tracked competitor list and flag them as "discoveredCompetitors".
4. Generate "ideasForYou": at least 20 concrete, actionable ideas tailored to ${profile.businessName}. **The user needs FAST, cheap-to-produce 30-second ads, not long-form video** — heavily favor "reel", "short", "static_post", "story", "meme", and "ad_creative" formats. Only suggest "long_video" or "carousel" rarely, and only when the concept genuinely cannot work as a quick 30-second piece (e.g. a detailed case study) — aim for at most 1-2 out of every 10 ideas in those two formats combined, the rest must be quick-hit formats. Every "concept" and "scriptOrCaption" must be written assuming a ~30 second runtime (a single hook + one clear point + one call to action — not a multi-scene narrative). Every idea MUST include a "sourceRef" pointing at one specific entry from "trendingNow" or a competitor's "examples" (reuse its exact "id" as "exampleId", plus copy its title/url/platform/brandName/engagementSignal) and a concrete "whyPicked" explaining exactly why that example justifies this idea. Prefer real ("scraped") sources over ai_estimate ones when both fit. If genuinely no single example inspired it, set "exampleId" to "" and explain in "whyPicked" what general trend justifies it instead — never leave "whyPicked" generic or empty.

Return JSON:
{
  "trendingNow": [{
    "id": string, "platform": string, "brandName": string, "isOwnBrand": boolean,
    "format": "reel"|"short"|"meme"|"static_post"|"carousel"|"long_video"|"story"|"ad_creative",
    "title": string, "description": string, "whyTrending": string, "hook": string,
    "engagementSignal": string, "sourceType": "scraped"|"ai_estimate", "url": string, "publishedAt": string,
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

  const withId = (item: Record<string, unknown>) => ({
    sourceType: "ai_estimate" as const,
    id: randomUUID(),
    ...item,
  });
  // Real ids come pre-assigned from our own scraped data — never mint a new one for those.
  const withRealAwareId = (item: Record<string, unknown>) =>
    typeof item.id === "string" && realById.has(item.id) ? item : withId(item);

  let trendingNow: TrendingAdExample[] = (result.data.trendingNow ?? [])
    .map((e) => safeParse(trendingAdExampleSchema, withRealAwareId(e)))
    .filter((e): e is TrendingAdExample => e !== null);
  trendingNow = mergeMissingReal(reassertReal(trendingNow, realById), realTrendingExamples);

  const competitorActivity: CompetitorAdActivity[] = (result.data.competitorActivity ?? [])
    .map((e) =>
      safeParse(competitorAdActivitySchema, {
        ...e,
        examples: Array.isArray(e.examples)
          ? e.examples.map((ex) => withRealAwareId(ex as Record<string, unknown>))
          : [],
      }),
    )
    .filter((e): e is CompetitorAdActivity => e !== null)
    .map((c) => ({
      ...c,
      examples: mergeMissingReal(reassertReal(c.examples, realById), realCompetitorExamples[c.competitorName] ?? []),
    }));

  for (const [name, examples] of Object.entries(realCompetitorExamples)) {
    if (!competitorActivity.some((c) => c.competitorName === name)) {
      competitorActivity.push({ competitorName: name, isDiscovered: false, examples });
    }
  }

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
    competitorSocialHandles,
    discoveredCompetitors: result.data.discoveredCompetitors ?? [],
    trendingNow,
    ideasForYou,
    competitorActivity,
    provenance: createProvenance("search", result.citations, 0.75),
  };
}
