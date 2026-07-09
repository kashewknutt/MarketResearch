import { runApifyActor } from "@/lib/integrations/apify";

const ACTOR_ID = "apify~instagram-scraper";

export interface InstagramPostSignal {
  url: string;
  caption: string;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  timestamp?: string;
  mediaType: string;
  hashtags: string[];
  ownerUsername: string;
}

interface RawInstagramItem {
  url?: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  type?: string;
  hashtags?: string[];
  ownerUsername?: string;
}

function normalize(item: RawInstagramItem): InstagramPostSignal | null {
  if (!item.url) return null;
  return {
    url: item.url,
    caption: item.caption ?? "",
    likeCount: item.likesCount != null && item.likesCount >= 0 ? item.likesCount : undefined,
    commentCount: item.commentsCount,
    viewCount: item.videoViewCount ?? item.videoPlayCount,
    timestamp: item.timestamp,
    mediaType: item.type ?? "Image",
    hashtags: item.hashtags ?? [],
    ownerUsername: item.ownerUsername ?? "",
  };
}

export async function fetchInstagramProfilePosts(
  username: string,
  limit = 8,
): Promise<InstagramPostSignal[]> {
  const cleanUsername = username.replace(/^@/, "").trim();
  if (!cleanUsername) return [];

  const items = await runApifyActor<RawInstagramItem>(ACTOR_ID, {
    resultsType: "posts",
    directUrls: [`https://www.instagram.com/${cleanUsername}/`],
    resultsLimit: limit,
  });
  return items.map(normalize).filter((p): p is InstagramPostSignal => p !== null);
}

export async function fetchInstagramHashtagPosts(
  hashtag: string,
  limit = 8,
): Promise<InstagramPostSignal[]> {
  const cleanTag = hashtag.replace(/^#/, "").trim();
  if (!cleanTag) return [];

  const items = await runApifyActor<RawInstagramItem>(ACTOR_ID, {
    resultsType: "posts",
    directUrls: [`https://www.instagram.com/explore/tags/${cleanTag}/`],
    resultsLimit: limit,
  });
  return items.map(normalize).filter((p): p is InstagramPostSignal => p !== null);
}
