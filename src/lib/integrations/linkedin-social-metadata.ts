import { linkedInRestHeaders } from "./linkedin-api";
import { linkedInAuthorizedFetch } from "./linkedin-oauth";
import type { EngagementMetrics } from "@/lib/types/domain";

interface SocialMetadataResponse {
  reactionSummaries?: Record<string, { reactionType?: string; count?: number }>;
  commentSummary?: { count?: number; topLevelCount?: number };
}

export interface LinkedInSocialMetadataResult {
  ok: boolean;
  metrics?: EngagementMetrics;
  permissionDenied?: boolean;
  message?: string;
}

/**
 * Reading engagement for a post needs `r_member_social_feed`, a permission LinkedIn grants
 * to select developers only (unlike posting, which is self-serve). A 403 here is an expected,
 * documented outcome — not a bug — so it's reported distinctly for the UI to fall back to
 * manual entry rather than surfaced as a generic error.
 */
export async function getLinkedInSocialMetadata(postUrn: string): Promise<LinkedInSocialMetadataResult> {
  const url = `https://api.linkedin.com/rest/socialMetadata/${encodeURIComponent(postUrn)}`;

  const res = await linkedInAuthorizedFetch(url, { headers: linkedInRestHeaders() });

  if (res.status === 403) {
    return {
      ok: false,
      permissionDenied: true,
      message:
        "LinkedIn hasn't granted your app read access to post engagement (r_member_social_feed is restricted). Enter stats manually below.",
    };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, message: `LinkedIn social metadata request failed (${res.status}): ${text.slice(0, 200)}` };
  }

  const data = (await res.json()) as SocialMetadataResponse;
  const likeCount = Object.values(data.reactionSummaries ?? {}).reduce(
    (sum, r) => sum + (r.count ?? 0),
    0,
  );

  return {
    ok: true,
    metrics: {
      likeCount,
      commentCount: data.commentSummary?.count,
    },
  };
}
