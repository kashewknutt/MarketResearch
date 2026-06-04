/**
 * LinkedIn Marketing / Advertising API version (YYYYMM).
 * @see https://learn.microsoft.com/en-us/linkedin/marketing/versioning
 */
export const LINKEDIN_API_VERSION =
  process.env.LINKEDIN_API_VERSION?.trim() || "202605";

export function linkedInRestHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  return {
    "LinkedIn-Version": LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
    ...extra,
  };
}
