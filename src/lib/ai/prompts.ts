import { formatMoney } from "@/lib/currency";
import type { OnboardingProfile, RegionCode } from "@/lib/types/domain";

const CURRENT_YEAR = new Date().getFullYear();

export function domainUnderstandingPrompt(profile: OnboardingProfile): string {
  return `Analyze this service business for market research (year ${CURRENT_YEAR}):
Business: ${profile.businessName}
Website: ${profile.website}
Domain: ${profile.serviceDomain}
Target audience: ${profile.targetAudience}
Regions: ${profile.regions.join(", ")}
Social: ${(profile.socialLinks ?? []).map((s) => `${s.platform}: ${s.url}`).join(", ") || "none"}
Currency: ${profile.currency}
Current MRR: ${formatMoney(profile.currentMrr, profile.currency)}
Target MRR (monthly, end of horizon): ${formatMoney(profile.targetMrr, profile.currency)} in ${profile.goalMonths} months
Goals: ${profile.strategicGoals}
Constraints: ${profile.constraints}

Return JSON: { "summary": string, "positioning": string, "keyInsights": string[] }`;
}

export function demandDiscoveryPrompt(
  profile: OnboardingProfile,
  region: RegionCode,
): string {
  return `For a ${profile.serviceDomain} service business targeting ${profile.targetAudience} in ${region}, list the top 10 current market demands/opportunities in ${CURRENT_YEAR}.

Return JSON: { "demands": [{ "title": string, "description": string, "ticketSizeMin": number, "ticketSizeMax": number, "currency": string }] }`;
}

export function projectsPrompt(
  profile: OnboardingProfile,
  region: RegionCode,
  count: number,
  excludeTitles: string[] = [],
): string {
  return `Generate ${count} specific project opportunities for ${profile.businessName} (${profile.serviceDomain}) in ${region} for ${CURRENT_YEAR}.
Target: ${profile.targetAudience}. Exclude: ${excludeTitles.join(", ") || "none"}.

Return JSON: { "projects": [{ "title": string, "summary": string, "explanation": string, "ticketSize": number, "currency": string, "effort": "low"|"medium"|"high", "expectedValue": string, "nextStep": string }] }`;
}

export function marketingPrompt(profile: OnboardingProfile): string {
  return `Create marketing recommendations for ${profile.businessName} (${profile.serviceDomain}), regions ${profile.regions.join(", ")}.

Return JSON: {
  "positioning": string,
  "contentThemes": [{ "title": string, "description": string, "priority": "high"|"medium"|"low", "region": string|null }],
  "offers": [{ "title": string, "description": string, "priority": "high"|"medium"|"low", "region": string|null }],
  "channels": [{ "title": string, "description": string, "priority": "high"|"medium"|"low", "region": string|null }],
  "proofAssets": [{ "title": string, "description": string, "priority": "high"|"medium"|"low", "region": string|null }]
}`;
}

export function strategyPrompt(profile: OnboardingProfile): string {
  return `Strategic analysis for ${profile.businessName} in ${profile.regions.join(" and ")}.

Return JSON: {
  "idealCustomerProfile": string,
  "demandClusters": string[],
  "regionComparison": { "${profile.regions[0] || "US"}": string, "${profile.regions[1] || "India"}": string },
  "marketFit": string,
  "expansionOpportunities": string[],
  "risks": string[],
  "priorities": string[]
}`;
}

export function investmentPrompt(
  profile: OnboardingProfile,
  gapToGoal: number,
): string {
  return `Investment allocation for ${profile.businessName}. Current MRR ${formatMoney(profile.currentMrr, profile.currency)}, target MRR ${formatMoney(profile.targetMrr, profile.currency)} in ${profile.goalMonths} months. Monthly MRR gap ~${formatMoney(gapToGoal, profile.currency)}.

Return JSON: {
  "totalRecommended": number,
  "allocations": [{ "category": string, "amount": number, "percentage": number, "rationale": string, "expectedOutcome": string }]
}`;
}

export function financialVariablesPrompt(profile: OnboardingProfile): string {
  return `Suggest financial projection variables for ${profile.serviceDomain} service business.
Currency: ${profile.currency}. Current MRR: ${formatMoney(profile.currentMrr, profile.currency)}. Target MRR: ${formatMoney(profile.targetMrr, profile.currency)} in ${profile.goalMonths} months.

Estimate realistic monthly amounts for domain-specific expense line items (people, tools, marketing, operations). Examples for software: developers, designers, marketing staff, AI tools, LinkedIn ads, cloud hosting.

Return JSON: {
  "averageTicketUs": number,
  "averageTicketIndia": number,
  "closeRate": number (0-1),
  "leadVolume": number,
  "leadToCallRate": number (0-1),
  "callToCloseRate": number (0-1),
  "deliveryCapacity": number,
  "hiringCost": number,
  "hiringMonth": number,
  "grossMarginTarget": number (0-1),
  "marketingSpend": number,
  "toolingSpend": number,
  "retentionRate": number (0-1),
  "expenseLineItems": [{ "id": string, "name": string, "category": "people"|"tools"|"marketing"|"operations"|"other", "monthlyAmount": number, "headcount": number?, "unitCost": number?, "notes": string? }],
  "narrative": string,
  "leverageVariables": string[]
}`;
}
