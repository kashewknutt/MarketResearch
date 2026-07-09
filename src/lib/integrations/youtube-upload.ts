import { youtubeAuthorizedFetch } from "@/lib/integrations/youtube-oauth";

const UPLOAD_INIT_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

export interface YoutubeUploadMeta {
  title: string;
  description: string;
  privacyStatus: "public" | "unlisted" | "private";
}

/** Uploads a video via YouTube's resumable upload protocol. Requires YOUTUBE_OAUTH_* env vars. */
export async function uploadYoutubeVideo(
  bytes: Buffer,
  meta: YoutubeUploadMeta,
): Promise<{ videoId: string }> {
  const initRes = await youtubeAuthorizedFetch(UPLOAD_INIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Upload-Content-Type": "video/*",
      "X-Upload-Content-Length": String(bytes.length),
    },
    body: JSON.stringify({
      snippet: { title: meta.title, description: meta.description },
      status: { privacyStatus: meta.privacyStatus },
    }),
  });

  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    throw new Error(`YouTube upload init failed (${initRes.status}): ${text.slice(0, 300)}`);
  }

  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) {
    throw new Error("YouTube upload init succeeded but returned no upload URL (Location header).");
  }

  // Unlike LinkedIn's pre-signed upload URLs, Google's resumable session URI still
  // requires the same Bearer token used to initiate it.
  const uploadRes = await youtubeAuthorizedFetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/*", "Content-Length": String(bytes.length) },
    body: bytes as unknown as BodyInit,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "");
    throw new Error(`YouTube video upload failed (${uploadRes.status}): ${text.slice(0, 300)}`);
  }

  const data = (await uploadRes.json()) as { id?: string };
  if (!data.id) {
    throw new Error("YouTube upload succeeded but no video id was returned.");
  }
  return { videoId: data.id };
}
