import { NextResponse } from "next/server";
import {
  createLinkedInMediaPost,
  createLinkedInTextPost,
  uploadLinkedInImage,
  uploadLinkedInVideo,
} from "@/lib/integrations/linkedin-posts";
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
  let commentary: string | undefined;
  let mediaFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const commentaryField = form.get("commentary");
    commentary = typeof commentaryField === "string" && commentaryField.trim() ? commentaryField : undefined;
    const media = form.get("media");
    if (media instanceof File && media.size > 0) mediaFile = media;
  } else {
    const body = await request.json().catch(() => ({}));
    commentary = typeof body.commentary === "string" && body.commentary.trim() ? body.commentary : undefined;
  }

  commentary = commentary || idea.generatedContent?.captionOrPost || idea.scriptOrCaption;

  if (!commentary) {
    return NextResponse.json(
      { error: "Nothing to publish — generate content first." },
      { status: 400 },
    );
  }

  let postUrn: string;
  try {
    if (mediaFile) {
      const bytes = Buffer.from(await mediaFile.arrayBuffer());
      const isVideo = mediaFile.type.startsWith("video/");
      const { urn, kind } = isVideo
        ? { urn: (await uploadLinkedInVideo(bytes)).videoUrn, kind: "video" as const }
        : { urn: (await uploadLinkedInImage(bytes)).imageUrn, kind: "image" as const };
      ({ postUrn } = await createLinkedInMediaPost(commentary, { urn, kind }));
    } else {
      ({ postUrn } = await createLinkedInTextPost(commentary));
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const fresh = (await getSnapshot<AdTrendsSnapshot>("ads")) ?? ads;
  const publishedAt = new Date().toISOString();
  const updatedIdeas = fresh.ideasForYou.map((i) =>
    i.id === id
      ? {
          ...i,
          status: "published_linkedin" as const,
          statusUpdatedAt: publishedAt,
          linkedInPublish: { postUrn, publishedAt, commentaryUsed: commentary },
          publishInfo: {
            platform: "LinkedIn",
            url: `https://www.linkedin.com/feed/update/${postUrn}`,
            postedVia: "linkedin_api" as const,
            linkedInPostUrn: postUrn,
          },
        }
      : i,
  );
  const updated: AdTrendsSnapshot = { ...fresh, ideasForYou: updatedIdeas };
  await saveSnapshot("ads", updated);

  return NextResponse.json({ ads: updated, postUrn });
}
