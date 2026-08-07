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

export const MAX_COLD_CALL_FETCH_COUNT = 20;

export interface ColdCallFetchParams {
  city: string;
  region: RegionCode;
  /** One or more comma-separated Google Maps business categories — each is run as its own separate Places search. */
  keyword: string;
  count: number;
  /** What this batch of leads is for — a campaign, offer, or target description that grounds the pitch narrative. */
  campaignContext: string;
}

function parseCategories(keyword: string): string[] {
  const categories = keyword
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  return categories.length > 0 ? categories : [keyword.trim()];
}

export interface ColdCallProgress {
  completed: number;
  total: number;
  title: string;
}

const narrativeSchema = z.object({
  whyFit: z.string().min(1),
  painPoint: z.string().min(1),
  pitchOutline: z.string().min(1),
  contactHints: z.string().min(1),
  signals: z.array(z.string()).min(1),
});

async function synthesizeNarrative(
  profile: OnboardingProfile,
  business: { name: string; address?: string; phone: string; businessStatus?: string },
  campaignContext: string,
  trace: AiCallTrace,
) {
  const result = await generateStructuredJson({
    task: "cold_call_lead_narrative",
    systemInstruction:
      "B2B sales strategist writing internal notes for a founder about to cold-call a real local " +
      "business. Ground everything in the real facts given — never invent details. JSON only.",
    userPrompt: `Seller: ${profile.businessName} (${profile.serviceDomain}), targeting ${profile.targetAudience}.

Campaign / reason for this call list (what the seller told us they're calling about): ${campaignContext}

Business found via Google Maps (has a listed phone number, no website on file):
Name: ${business.name}
${business.address ? `Address: ${business.address}\n` : ""}Phone: ${business.phone}
${business.businessStatus ? `Status: ${business.businessStatus}\n` : ""}
Write, specific to the campaign above (not generic):
- "whyFit": why this business (having no website) is a plausible fit for this specific campaign/offer.
- "painPoint": the single biggest, most concrete problem this specific business likely faces (infer from its category, having no website, and its status/address — not invented specifics like names or numbers) that falls squarely within the seller's domain (${profile.serviceDomain}) to solve. Be specific to this business, not a generic industry statement.
- "pitchOutline": a short outline of what to pitch on the call, opening from that pain point and tailored to the campaign.
- "contactHints": practical advice for the call itself (e.g. who to ask for — there's no listed decision-maker, only a business phone line).
- "signals": 1-3 short signals supporting the fit (based only on the facts given, e.g. "no website listed despite active Google Business Profile").

Return JSON: { "whyFit": string, "painPoint": string, "pitchOutline": string, "contactHints": string, "signals": string[] }`,
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
  console.log(
    `[cold-call] requested ${params.count} lead(s) (capped to ${total}) for city="${params.city}" region="${params.region}"`,
  );

  const existingLeads = await getAllLeads();
  const knownCompanyNames = new Set(existingLeads.map((l) => normalizeCompanyName(l.company)));
  const knownPlaceIds = new Set(
    existingLeads.map((l) => l.googlePlaceId).filter((id): id is string => Boolean(id)),
  );

  const categories = parseCategories(params.keyword);
  console.log(`[cold-call] categories to search: ${categories.map((c) => `"${c}"`).join(", ")}`);

  const results: LeadRecord[] = [];
  let skippedDuplicates = 0;
  let totalRawResults = 0;
  let totalQualifying = 0;

  for (const category of categories) {
    if (results.length >= total) break;

    const query = `${category} in ${params.city}, ${params.region}`;
    console.log(`[cold-call] searching Google Places: "${query}" (requesting up to ${total * 2})`);

    const places = await searchGooglePlacesWithoutWebsite(query, total * 2);
    totalRawResults += places.length;
    totalQualifying += places.length;
    console.log(
      `[cold-call] Google Places returned ${places.length} candidate(s) with phone + no website for "${category}"`,
    );

    if (places.length === 0) {
      console.warn(
        `[cold-call] no qualifying places found for "${query}" — skipping this category. Not an error, just an empty result set.`,
      );
      continue;
    }

    for (const place of places) {
      if (results.length >= total) break;

      const normalized = normalizeCompanyName(place.displayName);
      if (knownCompanyNames.has(normalized) || knownPlaceIds.has(place.placeId)) {
        skippedDuplicates++;
        console.log(`[cold-call] skipping duplicate: "${place.displayName}" (${place.placeId})`);
        continue;
      }
      knownCompanyNames.add(normalized);
      knownPlaceIds.add(place.placeId);

      console.log(
        `[cold-call] processing "${place.displayName}" (category="${category}") — phone=${place.phone} address=${place.formattedAddress ?? "n/a"}`,
      );

      const trace: AiCallTrace = {
        operation: "research.cold_call_lead_narrative",
        category: "research",
        correlationId: randomUUID(),
        region: params.region,
        researchStage: "leads",
      };

      let narrative: Awaited<ReturnType<typeof synthesizeNarrative>>;
      try {
        narrative = await synthesizeNarrative(
          profile,
          {
            name: place.displayName,
            address: place.formattedAddress,
            phone: place.phone,
            businessStatus: place.businessStatus,
          },
          params.campaignContext,
          trace,
        );
        console.log(`[cold-call] Gemini narrative synthesized for "${place.displayName}"`);
      } catch (err) {
        console.error(`[cold-call] Gemini narrative synthesis failed for "${place.displayName}":`, err);
        throw err;
      }

      const enrichment = await enrichColdCallLead(profile, {
        name: place.displayName,
        address: place.formattedAddress,
      });
      console.log(
        `[cold-call] Perplexity enrichment for "${place.displayName}": ${enrichment ? `${enrichment.signals.length} signal(s)` : "skipped/unavailable"}`,
      );

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
        painPoint: narrative.painPoint,
        pitchOutline: narrative.pitchOutline,
        contactPlan: `Campaign: ${params.campaignContext}`,
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
      console.log(
        `[cold-call] saved lead "${lead.company}" (${lead.id}) — progress ${results.length + 1}/${total}`,
      );
      results.push(lead);
      onProgress?.({ completed: results.length, total, title: lead.company });
    }

    console.log(
      `[cold-call] after category "${category}": ${results.length}/${total} collected so far`,
    );
  }

  console.log(
    `[cold-call] done: ${results.length} of ${total} requested lead(s) saved across ${categories.length} categor${categories.length === 1 ? "y" : "ies"}, ${skippedDuplicates} duplicate(s) skipped, ${totalQualifying - results.length - skippedDuplicates} unused candidate(s) left over (${totalRawResults} raw Places result(s) total)`,
  );

  if (results.length < total) {
    console.warn(
      `[cold-call] SHORTFALL: only found ${results.length} of the ${total} requested lead(s). ` +
        `This happens when a category's Places search doesn't have enough businesses with a phone ` +
        `number and no website in "${params.city}, ${params.region}" — not an error, just a limit of ` +
        `how many real matches exist. Try more categories, a broader city/region, or a lower count.`,
    );
  }

  return results;
}
