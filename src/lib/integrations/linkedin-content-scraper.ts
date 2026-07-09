import { runApifyActor } from "@/lib/integrations/apify";

const ACTOR_ID = "harvestapi~linkedin-post-search";

export interface LinkedInPostSignal {
  url: string;
  content: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  /** Breakdown by reaction type (like/celebrate/support/love/insightful/funny), no "dislike" exists on LinkedIn. */
  reactionsBreakdown?: Record<string, number>;
  postedAt?: string;
  authorName: string;
}

interface RawLinkedInItem {
  linkedinUrl?: string;
  content?: string;
  postedAt?: { timestamp?: number; date?: string };
  author?: { name?: string };
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
    reactions?: Array<{ type?: string; count?: number }>;
  };
}

function normalize(item: RawLinkedInItem): LinkedInPostSignal | null {
  if (!item.linkedinUrl) return null;
  const reactionsBreakdown = item.engagement?.reactions?.length
    ? Object.fromEntries(
        item.engagement.reactions
          .filter((r) => r.type)
          .map((r) => [r.type as string, r.count ?? 0]),
      )
    : undefined;

  return {
    url: item.linkedinUrl,
    content: item.content ?? "",
    likeCount: item.engagement?.likes,
    commentCount: item.engagement?.comments,
    shareCount: item.engagement?.shares,
    reactionsBreakdown,
    postedAt: item.postedAt?.date,
    authorName: item.author?.name ?? "",
  };
}

/**
 * Fetches posts authored by a specific profile/company URL. Note: this actor still
 * requires a non-empty searchQueries entry even when targeting a specific author — results
 * may be sparse if the query doesn't match much of that author's content. Best-effort,
 * not a guaranteed full feed.
 */
export async function fetchLinkedInAuthorPosts(
  profileOrCompanyUrl: string,
  fallbackQuery: string,
  limit = 5,
): Promise<LinkedInPostSignal[]> {
  if (!profileOrCompanyUrl.trim()) return [];

  const items = await runApifyActor<RawLinkedInItem>(ACTOR_ID, {
    authorUrls: [profileOrCompanyUrl],
    searchQueries: [fallbackQuery],
    maxPosts: limit,
  });
  return items.map(normalize).filter((p): p is LinkedInPostSignal => p !== null);
}

export async function fetchLinkedInKeywordPosts(
  query: string,
  limit = 8,
): Promise<LinkedInPostSignal[]> {
  if (!query.trim()) return [];

  const items = await runApifyActor<RawLinkedInItem>(ACTOR_ID, {
    searchQueries: [query],
    maxPosts: limit,
  });
  return items.map(normalize).filter((p): p is LinkedInPostSignal => p !== null);
}
