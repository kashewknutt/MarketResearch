import type { AdIdea, AdIdeaSourceRef, CompetitorAdActivity, TrendingAdExample } from "@/lib/types/domain";

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
      whyPicked: idea.sourceRef?.whyPicked ?? idea.whyThisWorks,
    };
  }
  if (idea.sourceRef) return idea.sourceRef;
  return { title: "General market trend", whyPicked: idea.whyThisWorks };
}
