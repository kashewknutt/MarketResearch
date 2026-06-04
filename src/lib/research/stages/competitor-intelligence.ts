import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { createProvenance } from "@/lib/db/provenance";
import { competitorSchema, safeParse } from "@/lib/agents/validate";
import type { CompetitorSnapshot, OnboardingProfile } from "@/lib/types/domain";

export async function runCompetitorIntelligence(
  profile: OnboardingProfile,
  jobId: string,
): Promise<CompetitorSnapshot> {
  const trace: AiCallTrace = {
    operation: "research.competitors",
    category: "research",
    correlationId: jobId,
    researchStage: "competitor_intelligence",
  };

  const social = profile.socialLinks?.map((s) => `${s.platform}: ${s.url}`).join("\n") ?? "";

  const result = await generateStructuredJson<{
    competitors: Array<Record<string, unknown>>;
    userRecommendedSpendMin: number;
    userRecommendedSpendMax: number;
  }>({
    task: "competitors",
    systemInstruction:
      "Competitive intelligence analyst. Use web search. Cite sources. Currency: " +
      profile.currency,
    userPrompt: `Analyze competitors for ${profile.businessName} (${profile.serviceDomain}) in ${profile.regions.join(", ")}.
Social: ${social}

Return JSON:
{
  "competitors": [{
    "name": string,
    "region": string,
    "estimatedMarketingSpendMin": number,
    "estimatedMarketingSpendMax": number,
    "spendCurrency": "${profile.currency}",
    "positioning": string,
    "recommendedSpendNote": string,
    "sources": [{ "title": string, "uri": string }]
  }],
  "userRecommendedSpendMin": number,
  "userRecommendedSpendMax": number
}`,
    useGoogleSearch: true,
    parse: (raw) => raw as {
      competitors: Array<Record<string, unknown>>;
      userRecommendedSpendMin: number;
      userRecommendedSpendMax: number;
    },
    trace,
  });

  const competitors = (result.data.competitors ?? [])
    .map((c) => safeParse(competitorSchema, c))
    .filter((c): c is NonNullable<typeof c> => c !== null);

  return {
    competitors,
    userRecommendedSpendMin: result.data.userRecommendedSpendMin ?? 0,
    userRecommendedSpendMax: result.data.userRecommendedSpendMax ?? 0,
    spendCurrency: profile.currency,
    provenance: createProvenance("search", result.citations, 0.8),
  };
}
