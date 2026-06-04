import type { IntegrationStatus } from "./types";

/** LinkedIn is optional; only Advertising API (ad analytics) is used when configured. */
export function linkedinStatus(): IntegrationStatus {
  const token = Boolean(process.env.LINKEDIN_ACCESS_TOKEN);
  const account = Boolean(process.env.LINKEDIN_AD_ACCOUNT_ID?.trim());
  const configured = token && account;
  return {
    name: "LinkedIn Advertising API",
    configured,
    message: configured
      ? "Advertising API token and ad account ID configured"
      : token
        ? "Set LINKEDIN_AD_ACCOUNT_ID for real ad spend (token present)"
        : "Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_AD_ACCOUNT_ID — see README (Advertising API only)",
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
