import { generateStructuredJson } from "@/lib/ai/gemini";
import type {
  Citation,
  ExpenseLineItem,
  LinkedInAdHistory,
  OnboardingProfile,
} from "@/lib/types/domain";
import {
  linkedInCompanyUrlFromProfile,
  linkedinStatus,
} from "./linkedin";

/** Try LinkedIn Advertising API ad analytics (requires ad account + token). */
async function fetchAdAnalyticsFromApi(
  accountId: string,
  currency: string,
): Promise<LinkedInAdHistory | null> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token) return null;

  const now = new Date();
  const startYear = now.getFullYear() - 1;
  const accountUrn = `urn:li:sponsoredAccount:${accountId}`;
  const url = new URL("https://api.linkedin.com/rest/adAnalytics");
  url.searchParams.set("q", "analytics");
  url.searchParams.set("pivot", "ACCOUNT");
  url.searchParams.set("timeGranularity", "MONTHLY");
  url.searchParams.set(
    "dateRange",
    `(start:(year:${startYear},month:1,day:1),end:(year:${now.getFullYear()},month:${now.getMonth() + 1},day:${now.getDate()}))`,
  );
  url.searchParams.set("accounts", `List(${encodeURIComponent(accountUrn)})`);
  url.searchParams.set("fields", "costInLocalCurrency,dateRange");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        "LinkedIn-Version": "202401",
        "X-Restli-Protocol-Version": "2.0.0",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("LinkedIn adAnalytics:", res.status, text.slice(0, 200));
      return null;
    }

    const data = (await res.json()) as {
      elements?: Array<{
        costInLocalCurrency?: string;
        dateRange?: { start?: { year: number; month: number } };
      }>;
    };

    const monthlySpend = (data.elements ?? [])
      .map((el) => {
        const y = el.dateRange?.start?.year;
        const m = el.dateRange?.start?.month;
        if (!y || !m) return null;
        const amount = parseFloat(el.costInLocalCurrency ?? "0") || 0;
        return {
          month: `${y}-${String(m).padStart(2, "0")}`,
          amount: Math.round(amount),
          currency,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

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
          uri: "https://learn.microsoft.com/en-us/linkedin/marketing/integrations/ads-reporting",
        },
      ],
    };
  } catch (err) {
    console.warn("LinkedIn adAnalytics fetch failed:", err);
    return null;
  }
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
  const token = Boolean(process.env.LINKEDIN_ACCESS_TOKEN);
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
