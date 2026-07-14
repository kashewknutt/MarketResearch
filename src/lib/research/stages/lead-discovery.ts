import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { createProvenance } from "@/lib/db/provenance";
import { leadSchema, safeParse } from "@/lib/agents/validate";
import { linkedInCompanyUrlFromProfile } from "@/lib/integrations/linkedin";
import type { LeadRecord, OnboardingProfile, RegionCode } from "@/lib/types/domain";
import {
  getAllLeads,
  newLeadId,
  normalizeCompanyName,
  saveLeads,
} from "@/lib/store/leads";

export async function runLeadDiscovery(
  profile: OnboardingProfile,
  jobId: string,
): Promise<LeadRecord[]> {
  const existingLeads = await getAllLeads();
  const knownCompanyNames = new Set(existingLeads.map((l) => normalizeCompanyName(l.company)));
  const newLeads: LeadRecord[] = [];
  const linkedInPage = linkedInCompanyUrlFromProfile(profile.socialLinks);

  for (const region of profile.regions) {
    const trace: AiCallTrace = {
      operation: `research.leads_${region}`,
      category: "research",
      correlationId: jobId,
      region,
      researchStage: "lead_discovery",
    };

    const existingInRegion = existingLeads
      .filter((l) => l.region === region)
      .map((l) => l.company);

    const result = await generateStructuredJson<{
      leads: Array<Record<string, unknown>>;
    }>({
      task: `leads_${region}`,
      systemInstruction: "B2B lead researcher. JSON only. Cite sources.",
      userPrompt: `Find 8 companies in ${region} likely to buy ${profile.serviceDomain} from ${profile.businessName}.
Audience: ${profile.targetAudience}
Your company LinkedIn page (context only, no API): ${linkedInPage ?? "N/A"}
${existingInRegion.length > 0 ? `\nAlready-discovered companies in this region — find genuinely different ones, do NOT repeat any of these: ${existingInRegion.join(", ")}\n` : ""}
Return JSON: { "leads": [{ "company": string, "region": "${region}", "fitScore": number, "signals": string[], "contactHints": string, "whyFit": string, "whyPerfect": string, "pitchOutline": string (what to say), "contactPlan": string (step-by-step outreach), "objections": string[], "sources": [{ "title": string, "uri": string }] }] }`,
      useGoogleSearch: true,
      parse: (raw) => raw as { leads: Array<Record<string, unknown>> },
      trace,
    });

    for (const raw of result.data.leads ?? []) {
      const parsed = safeParse(leadSchema, raw);
      if (!parsed) continue;

      const normalized = normalizeCompanyName(parsed.company);
      if (knownCompanyNames.has(normalized)) continue;
      knownCompanyNames.add(normalized);

      newLeads.push({
        id: newLeadId(),
        company: parsed.company,
        region: parsed.region as RegionCode,
        fitScore: parsed.fitScore,
        signals: parsed.signals,
        contactHints: parsed.contactHints,
        whyFit: parsed.whyFit,
        whyPerfect: parsed.whyPerfect,
        pitchOutline: parsed.pitchOutline,
        contactPlan: parsed.contactPlan,
        objections: parsed.objections,
        sources: parsed.sources,
        status: "new",
        provenance: createProvenance("search", result.citations, 0.75),
        createdAt: new Date().toISOString(),
        source: "discovery",
      });
    }
  }

  await saveLeads(newLeads);
  return [...existingLeads, ...newLeads].sort((a, b) => b.fitScore - a.fitScore);
}
