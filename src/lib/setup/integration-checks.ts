import {
  fetchAdAnalyticsForAccount,
  verifyLinkedInAdAccountAccess,
} from "@/lib/integrations/linkedin-ad-analytics";
import { linkedInRestHeaders } from "@/lib/integrations/linkedin-api";
import { getLinkedInAccessToken, linkedInAuthorizedFetch } from "@/lib/integrations/linkedin-oauth";
import { redditEnvPresence, verifyRedditApi } from "@/lib/integrations/reddit";
import { verifyYoutubeApi, youtubeEnvPresence } from "@/lib/integrations/youtube";

export type IntegrationPresence = "none" | "partial" | "full";

export { redditEnvPresence };

export function youtubePresence(): "none" | "full" {
  return youtubeEnvPresence() ? "full" : "none";
}

export async function verifyYoutubeConnection(): Promise<{
  ok: boolean;
  message: string;
  detail?: string;
}> {
  return verifyYoutubeApi();
}

export function linkedinEnvPresence(): IntegrationPresence {
  const access = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  const refresh = process.env.LINKEDIN_REFRESH_TOKEN?.trim();
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const account = process.env.LINKEDIN_AD_ACCOUNT_ID?.trim();

  if (!access && !refresh && !clientId && !clientSecret && !account) return "none";

  const canAuth = Boolean(access || (refresh && clientId && clientSecret));
  if (!canAuth) return "partial";
  return "full";
}

export async function verifyRedditConnection(): Promise<{
  ok: boolean;
  message: string;
  detail?: string;
}> {
  return verifyRedditApi();
}

export async function verifyLinkedInConnection(): Promise<{
  ok: boolean;
  message: string;
  detail?: string;
}> {
  const token = await getLinkedInAccessToken();
  if (!token) {
    return {
      ok: false,
      message:
        "Could not obtain an access token. Set LINKEDIN_ACCESS_TOKEN or LINKEDIN_REFRESH_TOKEN with client id/secret.",
    };
  }

  const accountId = process.env.LINKEDIN_AD_ACCOUNT_ID?.trim();

  if (accountId) {
    const accountCheck = await verifyLinkedInAdAccountAccess(accountId);
    if (!accountCheck.ok) {
      return {
        ok: false,
        message: accountCheck.message,
        detail: accountCheck.detail,
      };
    }

    const analytics = await fetchAdAnalyticsForAccount(accountId, {
      monthsBack: 3,
    });

    if (analytics.ok) {
      const spendHint =
        analytics.rows.length > 0
          ? `Latest month spend: ${analytics.rows[analytics.rows.length - 1]!.amount}`
          : "No spend rows yet (account may have no campaigns in range).";
      return {
        ok: true,
        message: "LinkedIn Advertising API: ad account and analytics OK.",
        detail: `Account ${accountId}. ${spendHint}`,
      };
    }

    if (analytics.status === 400) {
      return {
        ok: true,
        message:
          "LinkedIn token and ad account OK; analytics query returned 400 (often no campaigns in date range). Financials may use AI estimates.",
        detail: analytics.body?.slice(0, 300),
      };
    }

    return {
      ok: false,
      message: `LinkedIn ad analytics returned ${analytics.status}.`,
      detail: analytics.body?.slice(0, 300),
    };
  }

  const res = await linkedInAuthorizedFetch(
    "https://api.linkedin.com/rest/adAccounts?q=search&pageSize=1",
    { headers: linkedInRestHeaders() },
  );

  if (res.ok) {
    return {
      ok: true,
      message: "LinkedIn access token is valid (Advertising API).",
      detail: "Add LINKEDIN_AD_ACCOUNT_ID for financial ad-spend import.",
    };
  }

  const text = await res.text();
  return {
    ok: false,
    message: `LinkedIn API returned ${res.status}. Verify Advertising API approval and token scopes.`,
    detail: text.slice(0, 300),
  };
}
