import type { AdIdea, AdIdeaSourceRef, CompetitorAdActivity, TrendingAdExample } from "@/lib/types/domain";

const MAX_EXISTING_IDEA_CONTEXT = 40;

/**
 * Which trending/competitor examples already have an active (non-trashed)
 * idea built from them. Derived live from the current ideas list rather
 * than a persisted flag — deleting an idea frees its source back up.
 */
export function getUsedSourceIds(ideas: AdIdea[]): Set<string> {
  const used = new Set<string>();
  for (const idea of ideas) {
    if (idea.deletedAt) continue;
    if (idea.sourceRef?.exampleId) used.add(idea.sourceRef.exampleId);
  }
  return used;
}

/** Dedupes by id and drops anything already used as inspiration for an existing idea. */
export function getUnusedExamples(
  examples: TrendingAdExample[],
  usedIds: Set<string>,
): TrendingAdExample[] {
  const seen = new Set<string>();
  const result: TrendingAdExample[] = [];
  for (const ex of examples) {
    if (usedIds.has(ex.id) || seen.has(ex.id)) continue;
    seen.add(ex.id);
    result.push(ex);
  }
  return result;
}

/**
 * Richer anti-repeat context than a bare title list — title, hook, format,
 * and the source it was inspired by, so the model can avoid repeating the
 * underlying concept/angle, not just dodge an exact title match.
 */
export function buildExistingIdeaContext(ideas: AdIdea[]): string {
  const active = ideas.filter((i) => !i.deletedAt).slice(0, MAX_EXISTING_IDEA_CONTEXT);
  if (active.length === 0) return "(none yet)";
  return active
    .map((i) => {
      const source = i.sourceRef?.title ? ` [source: ${i.sourceRef.title}]` : "";
      return `- "${i.title}" (${i.platform}/${i.format}) — hook: "${i.hook}"${source}`;
    })
    .join("\n");
}

export function buildExampleIndex(
  trendingNow: TrendingAdExample[],
  competitorActivity: CompetitorAdActivity[],
): Map<string, TrendingAdExample> {
  const index = new Map<string, TrendingAdExample>();
  for (const ex of trendingNow) index.set(ex.id, ex);
  for (const c of competitorActivity) for (const ex of c.examples) index.set(ex.id, ex);
  return index;
}

/**
 * Overwrites a parsed idea's sourceRef with the real matched example's data (never trusts
 * the model's copy of engagement numbers), or synthesizes a minimal stub so the UI never
 * again shows a bare "no source" with zero explanation.
 */
export function resolveIdeaSourceRef(
  idea: Pick<AdIdea, "sourceRef" | "whyThisWorks">,
  exampleIndex: Map<string, TrendingAdExample>,
): AdIdeaSourceRef {
  const matched = idea.sourceRef?.exampleId ? exampleIndex.get(idea.sourceRef.exampleId) : undefined;
  if (matched) {
    return {
      exampleId: matched.id,
      title: matched.title,
      url: matched.url,
      platform: matched.platform,
      brandName: matched.brandName,
      engagementSignal: matched.engagementSignal,
      metrics: matched.metrics,
      sourceType: matched.sourceType,
      fetchedAt: matched.fetchedAt,
      whyPicked: idea.sourceRef?.whyPicked ?? idea.whyThisWorks,
    };
  }
  if (idea.sourceRef) return idea.sourceRef;
  return { title: "General market trend", sourceType: "ai_estimate", whyPicked: idea.whyThisWorks };
}

/**
 * Force-overwrites metrics/url/sourceType on any parsed trendingNow/competitorActivity
 * example whose id matches one of the real, directly-scraped entries — in case Gemini's
 * enrichment pass altered them. Never trust the model's copy of real numbers.
 */
export function reassertScrapedMetrics(
  examples: TrendingAdExample[],
  realById: Map<string, TrendingAdExample>,
): TrendingAdExample[] {
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
