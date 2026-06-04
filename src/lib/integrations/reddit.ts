import type { IntegrationSignal, IntegrationStatus } from "./types";

export function redditEnvPresence(): "none" | "partial" | "full" {
  const id = process.env.REDDIT_CLIENT_ID?.trim();
  const secret = process.env.REDDIT_CLIENT_SECRET?.trim();
  const ua = process.env.REDDIT_USER_AGENT?.trim();
  const username = process.env.REDDIT_USERNAME?.trim();
  const password = process.env.REDDIT_PASSWORD?.trim();
  if (!id && !secret && !ua && !username && !password) return "none";
  if (id && secret && ua && username && password) return "full";
  return "partial";
}

export function redditStatus(): IntegrationStatus {
  const presence = redditEnvPresence();
  const ok = presence === "full";
  return {
    name: "Reddit",
    configured: ok,
    message: ok
      ? "Reddit API credentials configured"
      : presence === "partial"
        ? "Incomplete Reddit config — need CLIENT_ID, CLIENT_SECRET, USER_AGENT, USERNAME, PASSWORD (script app)"
        : "Set Reddit variables in .env — see README",
  };
}

async function createRedditClient() {
  const Snoowrap = (await import("snoowrap")).default;
  return new Snoowrap({
    userAgent: process.env.REDDIT_USER_AGENT!,
    clientId: process.env.REDDIT_CLIENT_ID!,
    clientSecret: process.env.REDDIT_CLIENT_SECRET!,
    username: process.env.REDDIT_USERNAME!,
    password: process.env.REDDIT_PASSWORD!,
  });
}

export async function fetchRedditSignals(
  query: string,
  limit = 5,
): Promise<IntegrationSignal[]> {
  if (redditEnvPresence() !== "full") return [];

  try {
    const reddit = await createRedditClient();
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

/** Used by setup checks — surfaces credential errors instead of swallowing them. */
export async function verifyRedditApi(): Promise<{
  ok: boolean;
  message: string;
  detail?: string;
}> {
  if (redditEnvPresence() === "none") {
    return { ok: false, message: "No Reddit env vars configured." };
  }
  if (redditEnvPresence() === "partial") {
    return {
      ok: false,
      message:
        "Incomplete Reddit config — script apps need REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT, REDDIT_USERNAME, and REDDIT_PASSWORD.",
    };
  }

  try {
    const reddit = await createRedditClient();
    const results = await reddit.search({ query: "software", limit: 1 });
    if (results.length > 0) {
      return {
        ok: true,
        message: "Reddit API search succeeded.",
        detail: `Sample: ${results[0]!.title.slice(0, 80)}`,
      };
    }
    return {
      ok: true,
      message: "Reddit API authenticated (probe search returned no posts).",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reddit API request failed";
    return { ok: false, message, detail: message.includes("credentials") ? "See README — script app requires account username/password." : undefined };
  }
}
