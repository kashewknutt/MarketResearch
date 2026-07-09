export interface YoutubeVideoSignal {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  viewCount?: number;
  likeCount?: number;
  thumbnailUrl?: string;
  url: string;
}

export function youtubeEnvPresence(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY?.trim());
}

/** Used by setup checks — surfaces API/key errors instead of swallowing them. */
export async function verifyYoutubeApi(): Promise<{
  ok: boolean;
  message: string;
  detail?: string;
}> {
  if (!youtubeEnvPresence()) {
    return { ok: false, message: "No YOUTUBE_API_KEY configured." };
  }

  try {
    const res = await ytFetch("search", {
      part: "snippet",
      q: "software business",
      type: "video",
      maxResults: "1",
    });
    const count = (res.items ?? []).length;
    if (count > 0) {
      return {
        ok: true,
        message: "YouTube Data API search succeeded.",
        detail: `Sample: ${res.items[0]?.snippet?.title?.slice(0, 80) ?? "(untitled)"}`,
      };
    }
    return { ok: true, message: "YouTube Data API authenticated (probe search returned no results)." };
  } catch (err) {
    const message = err instanceof Error ? err.message : "YouTube API request failed";
    return {
      ok: false,
      message,
      detail: message.includes("403")
        ? "Check that the YouTube Data API v3 is enabled for this key's Google Cloud project."
        : undefined,
    };
  }
}

interface YtSearchItem {
  id?: { videoId?: string; channelId?: string };
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string } };
  };
}

interface YtVideoStatsItem {
  id: string;
  statistics?: { viewCount?: string; likeCount?: string };
}

async function ytFetch(path: string, params: Record<string, string>) {
  const key = process.env.YOUTUBE_API_KEY!;
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`YouTube API ${path} failed: ${res.status}`);
  return res.json();
}

function toSignal(item: YtSearchItem, stats?: YtVideoStatsItem): YoutubeVideoSignal | null {
  const videoId = item.id?.videoId;
  if (!videoId || !item.snippet) return null;
  return {
    videoId,
    title: item.snippet.title ?? "",
    description: item.snippet.description ?? "",
    channelTitle: item.snippet.channelTitle ?? "",
    publishedAt: item.snippet.publishedAt ?? "",
    viewCount: stats?.statistics?.viewCount ? Number(stats.statistics.viewCount) : undefined,
    likeCount: stats?.statistics?.likeCount ? Number(stats.statistics.likeCount) : undefined,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

async function withStats(items: YtSearchItem[]): Promise<YoutubeVideoSignal[]> {
  const videoIds = items.map((i) => i.id?.videoId).filter((id): id is string => Boolean(id));
  if (videoIds.length === 0) return [];

  const statsRes = await ytFetch("videos", {
    part: "statistics",
    id: videoIds.join(","),
  }).catch(() => ({ items: [] as YtVideoStatsItem[] }));
  const statsById = new Map<string, YtVideoStatsItem>(
    (statsRes.items ?? []).map((s: YtVideoStatsItem) => [s.id, s]),
  );

  return items
    .map((item) => toSignal(item, item.id?.videoId ? statsById.get(item.id.videoId) : undefined))
    .filter((s): s is YoutubeVideoSignal => s !== null);
}

/** Searches for trending videos matching a query. Returns [] if YOUTUBE_API_KEY is unset. */
export async function searchTrendingVideos(
  query: string,
  opts?: { publishedAfter?: string; maxResults?: number },
): Promise<YoutubeVideoSignal[]> {
  if (!youtubeEnvPresence()) return [];

  try {
    const searchRes = await ytFetch("search", {
      part: "snippet",
      q: query,
      type: "video",
      order: "viewCount",
      maxResults: String(opts?.maxResults ?? 8),
      ...(opts?.publishedAfter ? { publishedAfter: opts.publishedAfter } : {}),
    });
    return await withStats(searchRes.items ?? []);
  } catch (err) {
    console.warn("YouTube trending search failed:", err);
    return [];
  }
}

/**
 * Best-effort: searches for videos from a channel matching a brand/company name.
 * This is a name match against YouTube's search index, not a verified brand-to-channel
 * resolution, so results can include unrelated channels with a similar name.
 */
export async function searchChannelVideos(
  channelOrBrandName: string,
  opts?: { maxResults?: number },
): Promise<YoutubeVideoSignal[]> {
  if (!youtubeEnvPresence()) return [];

  try {
    const searchRes = await ytFetch("search", {
      part: "snippet",
      q: channelOrBrandName,
      type: "video",
      order: "relevance",
      maxResults: String(opts?.maxResults ?? 5),
    });
    return await withStats(searchRes.items ?? []);
  } catch (err) {
    console.warn(`YouTube channel search failed for "${channelOrBrandName}":`, err);
    return [];
  }
}
