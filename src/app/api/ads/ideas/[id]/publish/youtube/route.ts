import { NextResponse } from "next/server";
import { uploadYoutubeVideo } from "@/lib/integrations/youtube-upload";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { AdTrendsSnapshot } from "@/lib/types/domain";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const ads = await getSnapshot<AdTrendsSnapshot>("ads");
  const idea = ads?.ideasForYou.find((i) => i.id === id);
  if (!ads || !idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected multipart/form-data with a video file." }, { status: 400 });
  }

  const form = await request.formData();
  const media = form.get("media");
  if (!(media instanceof File) || media.size === 0) {
    return NextResponse.json({ error: "No video file provided." }, { status: 400 });
  }

  const title = (form.get("title") as string) || idea.title;
  const description =
    (form.get("description") as string) || idea.generatedContent?.captionOrPost || idea.scriptOrCaption || "";
  const privacyStatus = (form.get("privacyStatus") as string) || "unlisted";
  if (!["public", "unlisted", "private"].includes(privacyStatus)) {
    return NextResponse.json({ error: "Invalid privacyStatus." }, { status: 400 });
  }

  let videoId: string;
  try {
    const bytes = Buffer.from(await media.arrayBuffer());
    ({ videoId } = await uploadYoutubeVideo(bytes, {
      title,
      description,
      privacyStatus: privacyStatus as "public" | "unlisted" | "private",
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "YouTube upload failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const fresh = (await getSnapshot<AdTrendsSnapshot>("ads")) ?? ads;
  const statusUpdatedAt = new Date().toISOString();
  const updatedIdeas = fresh.ideasForYou.map((i) =>
    i.id === id
      ? {
          ...i,
          status: "posted" as const,
          statusUpdatedAt,
          publishInfo: {
            platform: "YouTube",
            url: `https://youtu.be/${videoId}`,
            postedVia: "youtube_api" as const,
            youtubeVideoId: videoId,
          },
        }
      : i,
  );
  const updated: AdTrendsSnapshot = { ...fresh, ideasForYou: updatedIdeas };
  await saveSnapshot("ads", updated);

  return NextResponse.json({ ads: updated, videoId });
}
