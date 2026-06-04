import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { ModelPricingRates } from "@/lib/ai/pricing-types";
import { GEMINI_MODEL } from "@/lib/ai/constants";

const PRICING_URL = "https://ai.google.dev/gemini-api/docs/pricing";
const CACHE_KEY = "gemini_pricing_cache";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const FALLBACK: ModelPricingRates = {
  modelId: GEMINI_MODEL,
  inputPerMillionUsd: 0.5,
  outputPerMillionUsd: 3.0,
  searchPerThousandQueriesUsd: 14,
  freeSearchQueriesPerMonth: 5000,
  sourceUrl: PRICING_URL,
  sourceLabel: "Google Gemini API pricing (fallback)",
  fetchedAt: new Date().toISOString(),
  parseMethod: "fallback",
};

function parseGemini3FlashRates(html: string): Partial<ModelPricingRates> | null {
  const section = html.split("Gemini 3 Flash Preview")[1]?.split("## ")[0];
  if (!section) return null;

  const inputMatch = section.match(
    /\|\s*Input price\s*\|[^|]*\|[^$]*\$\s*([\d.]+)/i,
  );
  const outputMatch = section.match(
    /\|\s*Output price[^|]*\|[^|]*\|[^$]*\$\s*([\d.]+)/i,
  );
  const searchMatch = section.match(
    /Grounding with Google Search[^$]*\$\s*([\d.]+)\s*\/\s*1,?000 search queries/i,
  );
  const freeSearchMatch = section.match(
    /([\d,]+)\s*(?:prompts|requests) per month \(free/i,
  );

  if (!inputMatch?.[1] || !outputMatch?.[1]) return null;

  return {
    inputPerMillionUsd: parseFloat(inputMatch[1]),
    outputPerMillionUsd: parseFloat(outputMatch[1]),
    searchPerThousandQueriesUsd: searchMatch
      ? parseFloat(searchMatch[1])
      : 14,
    freeSearchQueriesPerMonth: freeSearchMatch
      ? parseInt(freeSearchMatch[1].replace(/,/g, ""), 10)
      : 5000,
  };
}

export async function fetchLivePricing(
  modelId: string = GEMINI_MODEL,
): Promise<ModelPricingRates> {
  const cached = await getSnapshot<{
    rates: ModelPricingRates;
    expiresAt: number;
  }>(CACHE_KEY);

  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.rates, parseMethod: "cache" };
  }

  try {
    const res = await fetch(PRICING_URL, {
      headers: { Accept: "text/html" },
      next: { revalidate: 0 },
    });

    if (!res.ok) throw new Error(`Pricing page HTTP ${res.status}`);

    const html = await res.text();
    const parsed = parseGemini3FlashRates(html);

    const rates: ModelPricingRates = {
      ...FALLBACK,
      ...parsed,
      modelId,
      sourceUrl: PRICING_URL,
      sourceLabel: "Google Gemini API pricing (live)",
      fetchedAt: new Date().toISOString(),
      parseMethod: parsed ? "live_html" : "fallback",
    };

    await saveSnapshot(CACHE_KEY, {
      rates,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return rates;
  } catch {
    return { ...FALLBACK, modelId };
  }
}

export function getBillingTier(): "paid" | "free" {
  const tier = process.env.GEMINI_BILLING_TIER?.toLowerCase();
  return tier === "free" ? "free" : "paid";
}
