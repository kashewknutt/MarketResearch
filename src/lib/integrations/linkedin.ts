import type { IntegrationStatus } from "./types";
import { linkedInOAuthConfigured } from "./linkedin-oauth";

/** LinkedIn is optional; only Advertising API (ad analytics) is used when configured. */
export function linkedinStatus(): IntegrationStatus {
  const token = linkedInOAuthConfigured();
  const account = Boolean(process.env.LINKEDIN_AD_ACCOUNT_ID?.trim());
  const refresh = Boolean(process.env.LINKEDIN_REFRESH_TOKEN?.trim());
  const oauth = Boolean(
    process.env.LINKEDIN_CLIENT_ID?.trim() && process.env.LINKEDIN_CLIENT_SECRET?.trim(),
  );
  const configured = token && account;
  return {
    name: "LinkedIn Advertising API",
    configured,
    message: configured
      ? `Advertising API ready${refresh && oauth ? " (auto-refresh enabled)" : ""}`
      : token
        ? "Set LINKEDIN_AD_ACCOUNT_ID for real ad spend (token present)"
        : "Set LINKEDIN_ACCESS_TOKEN, LINKEDIN_REFRESH_TOKEN, client id/secret, and LINKEDIN_AD_ACCOUNT_ID — see README",
  };
}

export function linkedinFromSocialUrl(url: string): string | null {
  if (!url.includes("linkedin.com")) return null;
  return url;
}

export function linkedInCompanyUrlFromProfile(
  socialLinks: { platform: string; url: string }[] | undefined,
): string | null {
  const link = socialLinks?.find((s) =>
    s.platform.toLowerCase().includes("linkedin"),
  );
  if (!link?.url) return null;
  return linkedinFromSocialUrl(link.url) ?? link.url;
}
