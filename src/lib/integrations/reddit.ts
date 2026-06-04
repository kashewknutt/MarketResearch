import type { IntegrationSignal, IntegrationStatus } from "./types";

export function redditStatus(): IntegrationStatus {
  const ok =
    Boolean(process.env.REDDIT_CLIENT_ID) &&
    Boolean(process.env.REDDIT_CLIENT_SECRET) &&
    Boolean(process.env.REDDIT_USER_AGENT);
  return {
    name: "Reddit",
    configured: ok,
    message: ok
      ? "Reddit API credentials configured"
      : "Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT in .env",
  };
}

export async function fetchRedditSignals(
  query: string,
  limit = 5,
): Promise<IntegrationSignal[]> {
  const status = redditStatus();
  if (!status.configured) return [];

  try {
    const Snoowrap = (await import("snoowrap")).default;
    const reddit = new Snoowrap({
      userAgent: process.env.REDDIT_USER_AGENT!,
      clientId: process.env.REDDIT_CLIENT_ID!,
      clientSecret: process.env.REDDIT_CLIENT_SECRET!,
    });

    const results = await reddit.search({ query, limit });
    return results.map((post) => ({
      source: "reddit",
      title: post.title,
      snippet: (post.selftext ?? "").slice(0, 300),
      url: `https://reddit.com${post.permalink}`,
    }));
  } catch (err) {
    console.warn("Reddit fetch failed:", err);
    return [];
  }
}
