import { randomUUID } from "crypto";
import { z } from "zod";
import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { safeParse } from "@/lib/agents/validate";
import { createProvenance } from "@/lib/db/provenance";
import { searchGooglePlacesWithoutWebsite } from "@/lib/integrations/google-places";
import { enrichColdCallLead } from "@/lib/integrations/perplexity";
import { getAllLeads, newLeadId, normalizeCompanyName, saveLeads } from "@/lib/store/leads";
import type { Citation, LeadRecord, OnboardingProfile, RegionCode } from "@/lib/types/domain";

/** Same cap convention as MAX_ON_DEMAND_FETCH_COUNT / MAX_FETCH_COUNT for on-demand fetches. */
export const MAX_COLD_CALL_FETCH_COUNT = 10;

export interface ColdCallFetchParams {
  city: string;
  region: RegionCode;
  keyword: string;
  count: number;
}

export interface ColdCallProgress {
  completed: number;
  total: number;
  title: string;
}

const narrativeSchema = z.object({
  whyFit: z.string().min(1),
  pitchOutline: z.string().min(1),
  contactHints: z.string().min(1),
  signals: z.array(z.string()).min(1),
});

async function synthesizeNarrative(
  profile: OnboardingProfile,
  business: { name: string; address?: string; phone: string; businessStatus?: string },
  trace: AiCallTrace,
) {
  const result = await generateStructuredJson({
    task: "cold_call_lead_narrative",
    systemInstruction:
      "B2B sales strategist writing internal notes for a founder about to cold-call a real local " +
      "business. Ground everything in the real facts given — never invent details. JSON only.",
    userPrompt: `Seller: ${profile.businessName} (${profile.serviceDomain}), targeting ${profile.targetAudience}.

Business found via Google Maps (has a listed phone number, no website on file):
Name: ${business.name}
${business.address ? `Address: ${business.address}\n` : ""}Phone: ${business.phone}
${business.businessStatus ? `Status: ${business.businessStatus}\n` : ""}
Write:
- "whyFit": why this business (having no website) is a plausible fit for the seller's services.
- "pitchOutline": a short outline of what to pitch on the call.
- "contactHints": practical advice for the call itself (e.g. who to ask for — there's no listed decision-maker, only a business phone line).
- "signals": 1-3 short signals supporting the fit (based only on the facts given, e.g. "no website listed despite active Google Business Profile").

Return JSON: { "whyFit": string, "pitchOutline": string, "contactHints": string, "signals": string[] }`,
    parse: (raw) => {
      const parsed = safeParse(narrativeSchema, raw);
      if (!parsed) throw new Error("Invalid cold-call narrative response");
      return parsed;
    },
    trace,
  });

  return result.data;
}

/**
 * Finds real local businesses with a Google Maps listing (phone number) but no website —
 * a cold-call-ready segment — via Google Places (New) Text Search. Phone/address/website
 * status come straight from Google's structured data (never AI-guessed); Gemini only
 * writes the pitch narrative around those real facts, and Perplexity optionally adds a
 * few extra cited signals if configured. Entirely separate from the existing
 * discovery/project lead pipelines — does not touch or replace them.
 */
export async function discoverColdCallLeads(
  profile: OnboardingProfile,
  params: ColdCallFetchParams,
  onProgress?: (progress: ColdCallProgress) => void,
): Promise<LeadRecord[]> {
  const total = Math.min(params.count, MAX_COLD_CALL_FETCH_COUNT);

  const existingLeads = await getAllLeads();
  const knownCompanyNames = new Set(existingLeads.map((l) => normalizeCompanyName(l.company)));
  const knownPlaceIds = new Set(
    existingLeads.map((l) => l.googlePlaceId).filter((id): id is string => Boolean(id)),
  );

  const query = `${params.keyword} in ${params.city}, ${params.region}`;
  const places = await searchGooglePlacesWithoutWebsite(query, total * 2);

  const results: LeadRecord[] = [];

  for (const place of places) {
    if (results.length >= total) break;

    const normalized = normalizeCompanyName(place.displayName);
    if (knownCompanyNames.has(normalized) || knownPlaceIds.has(place.placeId)) continue;
    knownCompanyNames.add(normalized);
    knownPlaceIds.add(place.placeId);

    const trace: AiCallTrace = {
      operation: "research.cold_call_lead_narrative",
      category: "research",
      correlationId: randomUUID(),
      region: params.region,
      researchStage: "leads",
    };

    const narrative = await synthesizeNarrative(
      profile,
      {
        name: place.displayName,
        address: place.formattedAddress,
        phone: place.phone,
        businessStatus: place.businessStatus,
      },
      trace,
    );

    const enrichment = await enrichColdCallLead(profile, {
      name: place.displayName,
      address: place.formattedAddress,
    });

    const sources: Citation[] = [
      ...(place.googleMapsUri
        ? [{ title: "Google Maps listing", uri: place.googleMapsUri }]
        : []),
      ...(enrichment?.citations ?? []),
    ];

    const lead: LeadRecord = {
      id: newLeadId(),
      company: place.displayName,
      region: params.region,
      fitScore: 60,
      signals: [...narrative.signals, ...(enrichment?.signals ?? [])],
      contactHints: narrative.contactHints,
      whyFit: narrative.whyFit,
      pitchOutline: narrative.pitchOutline,
      sources,
      status: "new",
      provenance: createProvenance("search", sources, 0.8),
      createdAt: new Date().toISOString(),
      source: "cold_call",
      companyPhone: place.phone,
      companyAddress: place.formattedAddress,
      googlePlaceId: place.placeId,
      businessStatus: place.businessStatus,
    };

    await saveLeads([lead]);
    results.push(lead);
    onProgress?.({ completed: results.length, total, title: lead.company });
  }

  return results;
}
