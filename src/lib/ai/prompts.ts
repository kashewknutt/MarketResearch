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

IMPORTANT: All monetary amounts must be in ${profile.currency} only — do not use USD unless profile currency is USD.

Return JSON: {
  "totalRecommended": number,
  "allocations": [{ "category": string, "amount": number, "percentage": number, "rationale": string, "expectedOutcome": string }]
}`;
}

export function financialVariablesPrompt(profile: OnboardingProfile): string {
  const months = profile.goalMonths;
  return `Build a domain-specific P&L metric workbook for ${profile.serviceDomain} (${profile.businessName}).
Currency: ${profile.currency}. Current MRR: ${formatMoney(profile.currentMrr, profile.currency)}. Target MRR: ${formatMoney(profile.targetMrr, profile.currency)} over ${months} months.

Step 1 — Define metrics[] for THIS domain (software agency example):
Revenue rows: "Revenue from Small Clients" (recurring:true), "Revenue from Enterprise", "Huge Client 1 Revenue", "Huge Client 2 Revenue"
Expense rows: Developer Salaries, Founder Draws, Developer AI Tools, AI Tool Costs, SaaS Subscriptions, Cloud Hosting, Office/Admin, Marketing Spend, Video Production, Graphic Design, Travel & Sales, Miscellaneous

Adapt labels to ${profile.serviceDomain} — same structure: recurring small revenue + lumpy enterprise/whale rows + detailed expense lines.

Step 2 — For EACH metric id, provide monthly amounts arrays of length ${months} (index 0 = month 1) in conservative and ambitious objects keyed by metric id.

Rules:
- All amounts in ${profile.currency} only.
- Small/recurring revenue steady month-to-month; enterprise ~3 spikes per year; huge clients 0-2 large months in ambitious.
- Marketing Spend should often scale ~8-12% of that month's total revenue.
- Conservative: lower revenue, fewer whale months; ambitious: path toward target MRR on recurring row by month ${months}.

Return JSON: {
  "metrics": [{ "id": string (stable slug), "label": string, "kind": "revenue"|"expense", "group": string, "recurring": boolean?, "order": number }],
  "conservative": { "<metricId>": [number x${months}], ... },
  "ambitious": { "<metricId>": [number x${months}], ... },
  "monthlyChurnRate": number (0-0.2),
  "expenseLineItems": [{ "id": string, "name": string, "category": "people"|"tools"|"marketing"|"operations"|"other", "monthlyAmount": number }],
  "narrative": string,
  "leverageVariables": string[]
}`;
}
