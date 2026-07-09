import type { AdPublishInfo } from "@/lib/types/domain";

function extractLinkedInUrn(url: string): string | undefined {
  const match = url.match(/urn:li:(?:activity|share|ugcPost):\d+/i);
  return match?.[0];
}

function extractYoutubeVideoId(url: string): string | undefined {
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  return shortMatch?.[1];
}

/** Builds publish metadata from a manually-entered platform + URL, parsing known URL shapes. */
export function buildManualPublishInfo(platform: string, url?: string): AdPublishInfo {
  const info: AdPublishInfo = { platform, url, postedVia: "manual" };
  if (!url) return info;

  if (platform.toLowerCase() === "linkedin") {
    const urn = extractLinkedInUrn(url);
    if (urn) info.linkedInPostUrn = urn;
  }
  if (platform.toLowerCase() === "youtube") {
    const videoId = extractYoutubeVideoId(url);
    if (videoId) info.youtubeVideoId = videoId;
  }
  return info;
}
