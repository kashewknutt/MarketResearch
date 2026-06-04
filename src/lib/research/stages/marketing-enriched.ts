import { randomUUID } from "crypto";
import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { marketingPrompt } from "@/lib/ai/prompts";
import { createProvenance } from "@/lib/db/provenance";
import { marketingItemEnrichedSchema, safeParse } from "@/lib/agents/validate";
import type { MarketingItem, MarketingSnapshot, OnboardingProfile } from "@/lib/types/domain";

type RawItem = {
  title: string;
  description: string;
  priority: string;
  region: string | null;
  why?: string;
  expectedMetrics?: Array<{ label: string; value: string; unit?: string }>;
  precedents?: Array<{
    company: string;
    action: string;
    reportedResult: string;
    metric?: string;
    sourceUri?: string;
  }>;
  estimatedCost?: number;
};

function toEnrichedItems(
  category: string,
  items: RawItem[],
  citations: MarketingSnapshot["provenance"]["citations"],
  currency: string,
): MarketingItem[] {
  return items.map((item) => {
    const enriched = safeParse(marketingItemEnrichedSchema, item);
    return {
      id: randomUUID(),
      category,
      title: item.title,
      description: item.description,
      priority: item.priority as MarketingItem["priority"],
      region: item.region ?? undefined,
      why: enriched?.why ?? item.why,
      expectedMetrics: enriched?.expectedMetrics ?? item.expectedMetrics,
      precedents: enriched?.precedents ?? item.precedents,
      estimatedCost: enriched?.estimatedCost ?? item.estimatedCost,
      estimatedCostCurrency: currency,
      citations,
      provenance: createProvenance("search", citations, 0.82),
    };
  });
}

export async function runEnrichedMarketing(
  profile: OnboardingProfile,
  jobId: string,
): Promise<MarketingSnapshot> {
  const trace: AiCallTrace = {
    operation: "research.marketing",
    category: "research",
    correlationId: jobId,
    researchStage: "marketing_planning",
  };

  const result = await generateStructuredJson<{
    positioning: string;
    contentThemes: RawItem[];
    offers: RawItem[];
    channels: RawItem[];
    proofAssets: RawItem[];
  }>({
    task: "marketing_enriched",
    systemInstruction:
      "Marketing strategist. Each item needs why, metrics, precedents with results. JSON only.",
    userPrompt: `${marketingPrompt(profile)}

Extend each item with: why (for this business), expectedMetrics[], precedents[] (company, action, reportedResult, metric), estimatedCost in ${profile.currency}.`,
    useGoogleSearch: true,
    parse: (raw) => raw as {
      positioning: string;
      contentThemes: RawItem[];
      offers: RawItem[];
      channels: RawItem[];
      proofAssets: RawItem[];
    },
    trace,
  });

  const citations = result.citations;
  return {
    positioning: result.data.positioning,
    contentThemes: toEnrichedItems("content", result.data.contentThemes ?? [], citations, profile.currency),
    offers: toEnrichedItems("offer", result.data.offers ?? [], citations, profile.currency),
    channels: toEnrichedItems("channel", result.data.channels ?? [], citations, profile.currency),
    proofAssets: toEnrichedItems("proof", result.data.proofAssets ?? [], citations, profile.currency),
    provenance: createProvenance("search", citations, 0.82),
  };
}
