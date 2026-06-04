import { generateStructuredJson } from "@/lib/ai/gemini";
import type {
  Citation,
  ExpenseLineItem,
  LinkedInAdHistory,
  OnboardingProfile,
} from "@/lib/types/domain";
import {
  fetchAdAnalyticsForAccount,
  verifyLinkedInAdAccountAccess,
} from "./linkedin-ad-analytics";
import { linkedInCompanyUrlFromProfile } from "./linkedin";
import { linkedInOAuthConfigured } from "./linkedin-oauth";

/** Try LinkedIn Advertising API ad analytics (requires ad account + token). */
async function fetchAdAnalyticsFromApi(
  accountId: string,
  currency: string,
): Promise<LinkedInAdHistory | null> {
  const result = await fetchAdAnalyticsForAccount(accountId, { monthsBack: 12 });
  if (!result.ok) {
    const snippet =
      process.env.NODE_ENV === "development"
        ? result.body
        : result.body?.slice(0, 500);
    console.warn("LinkedIn ad spend fetch failed:", result.status, snippet);
    return null;
  }

  const monthlySpend = result.rows.map((r) => ({
    month: r.month,
    amount: r.amount,
    currency,
  }));

  if (!monthlySpend.length) return null;

  const totalLast12Months = monthlySpend.reduce((s, x) => s + x.amount, 0);
  return {
    available: true,
    message: "Loaded from LinkedIn Advertising API (ad account analytics).",
    accountId,
    totalLast12Months,
    currency,
    monthlySpend,
    citations: [
      {
        title: "LinkedIn Advertising API — adAnalytics",
        uri: "https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting/ads-reporting?view=li-lms-2026-05",
      },
    ],
  };
}

/** Estimate historical ad spend via search when API is unavailable. */
async function fetchAdSpendViaResearch(
  profile: OnboardingProfile,
): Promise<LinkedInAdHistory> {
  const companyUrl = linkedInCompanyUrlFromProfile(profile.socialLinks);
  const result = await generateStructuredJson<{
    available: boolean;
    message: string;
    estimatedMonthlyAverage?: number;
    monthlySpend: Array<{ month: string; amount: number }>;
    citations: Array<{ title: string; uri?: string }>;
  }>({
    task: "linkedin_ad_research",
    systemInstruction:
      "You estimate B2B LinkedIn ad spend from public signals. Be conservative. Cite sources. JSON only.",
    userPrompt: `Estimate LinkedIn advertising spend history for "${profile.businessName}" (${profile.serviceDomain}).
Website: ${profile.website}
LinkedIn: ${companyUrl ?? "unknown"}
Currency for amounts: ${profile.currency}

Search for: LinkedIn ads spend, sponsored content, campaign activity, marketing budget signals.

Return JSON:
{
  "available": boolean,
  "message": string,
  "estimatedMonthlyAverage": number,
  "monthlySpend": [{ "month": "YYYY-MM", "amount": number }],
  "citations": [{ "title": string, "uri": string }]
}`,
    useGoogleSearch: true,
    parse: (raw) => raw as {
      available: boolean;
      message: string;
      estimatedMonthlyAverage?: number;
      monthlySpend: Array<{ month: string; amount: number }>;
      citations: Array<{ title: string; uri?: string }>;
    },
    trace: {
      operation: "research.linkedin_ads",
      category: "research",
      researchStage: "financial_modeling",
    },
  });

  const monthlySpend = (result.data.monthlySpend ?? []).map((m) => ({
    month: m.month,
    amount: Math.round(m.amount),
    currency: profile.currency,
  }));

  const totalLast12Months = monthlySpend.reduce((s, x) => s + x.amount, 0);

  return {
    available: result.data.available && monthlySpend.length > 0,
    message: result.data.message,
    totalLast12Months: totalLast12Months || result.data.estimatedMonthlyAverage,
    currency: profile.currency,
    monthlySpend,
    citations: (result.citations.length
      ? result.citations
      : result.data.citations) as Citation[],
  };
}

export function applyLinkedInAdsToLineItems(
  items: ExpenseLineItem[],
  history: LinkedInAdHistory | undefined,
): ExpenseLineItem[] {
  if (!history?.available || !history.monthlySpend.length) return items;

  const recent = history.monthlySpend.slice(-3);
  const avg = Math.round(
    recent.reduce((s, m) => s + m.amount, 0) / Math.max(1, recent.length),
  );

  return items.map((item) => {
    if (
      item.source === "linkedin" ||
      item.name.toLowerCase().includes("linkedin")
    ) {
      return {
        ...item,
        monthlyAmount: avg,
        source: "linkedin" as const,
        notes: `Based on LinkedIn ad history (avg of last ${recent.length} months: ${avg} ${history.currency}). ${history.message}`,
      };
    }
    return item;
  });
}

export async function fetchLinkedInAdHistory(
  profile: OnboardingProfile,
): Promise<LinkedInAdHistory> {
  const token = linkedInOAuthConfigured();
  const accountId = process.env.LINKEDIN_AD_ACCOUNT_ID?.trim();
  const companyUrl = linkedInCompanyUrlFromProfile(profile.socialLinks);

  if (accountId && token) {
    const fromApi = await fetchAdAnalyticsFromApi(accountId, profile.currency);
    if (fromApi) return fromApi;
  }

  if (token || companyUrl) {
    return fetchAdSpendViaResearch(profile);
  }

  return {
    available: false,
    message:
      "LinkedIn ad data unavailable. Request Advertising API access, set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AD_ACCOUNT_ID, or add a LinkedIn company URL in onboarding.",
    currency: profile.currency,
    monthlySpend: [],
    citations: [],
  };
}
