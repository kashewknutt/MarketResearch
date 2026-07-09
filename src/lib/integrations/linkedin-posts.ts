import { linkedInRestHeaders } from "./linkedin-api";
import { linkedInAuthorizedFetch } from "./linkedin-oauth";

const POSTS_URL = "https://api.linkedin.com/rest/posts";

export function linkedInPersonUrnConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_PERSON_URN?.trim());
}

function requirePersonUrn(): string {
  const personUrn = process.env.LINKEDIN_PERSON_URN?.trim();
  if (!personUrn) {
    throw new Error("LINKEDIN_PERSON_URN is not configured — see README LinkedIn publishing section.");
  }
  return personUrn;
}

/** Creates a text/caption post on LinkedIn as the configured member. No media. */
export async function createLinkedInTextPost(commentary: string): Promise<{ postUrn: string }> {
  return postToLinkedIn({ commentary });
}

export async function createLinkedInMediaPost(
  commentary: string,
  media: { urn: string; kind: "image" | "video" },
): Promise<{ postUrn: string }> {
  await waitForMediaAvailable(media.kind, media.urn);
  return postToLinkedIn({ commentary, content: { media: { id: media.urn } } });
}

async function postToLinkedIn(extra: Record<string, unknown>): Promise<{ postUrn: string }> {
  const personUrn = requirePersonUrn();
  const body = {
    author: personUrn,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
    ...extra,
  };

  const res = await linkedInAuthorizedFetch(POSTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...linkedInRestHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (res.status !== 201) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn post failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const postUrn = res.headers.get("x-restli-id");
  if (!postUrn) {
    throw new Error("LinkedIn post created but no x-restli-id header returned.");
  }
  return { postUrn };
}

/** Registers an upload, PUTs the bytes (single request, no chunking needed for images), returns the image urn. */
export async function uploadLinkedInImage(bytes: Buffer): Promise<{ imageUrn: string }> {
  const personUrn = requirePersonUrn();

  const initRes = await linkedInAuthorizedFetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...linkedInRestHeaders() },
    body: JSON.stringify({ initializeUploadRequest: { owner: personUrn } }),
  });
  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    throw new Error(`LinkedIn image upload init failed (${initRes.status}): ${text.slice(0, 300)}`);
  }
  const initData = (await initRes.json()) as { value: { uploadUrl: string; image: string } };

  const putRes = await fetch(initData.value.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: bytes as unknown as BodyInit,
  });
  if (!putRes.ok) {
    throw new Error(`LinkedIn image byte upload failed (${putRes.status})`);
  }

  return { imageUrn: initData.value.image };
}

interface VideoUploadInstruction {
  firstByte: number;
  lastByte: number;
  uploadUrl: string;
}

/** Registers an upload, splits bytes into the actor-specified parts, PUTs each, then finalizes. */
export async function uploadLinkedInVideo(bytes: Buffer): Promise<{ videoUrn: string }> {
  const personUrn = requirePersonUrn();

  const initRes = await linkedInAuthorizedFetch("https://api.linkedin.com/rest/videos?action=initializeUpload", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...linkedInRestHeaders() },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
        fileSizeBytes: bytes.length,
        uploadCaptions: false,
        uploadThumbnail: false,
      },
    }),
  });
  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    throw new Error(`LinkedIn video upload init failed (${initRes.status}): ${text.slice(0, 300)}`);
  }
  const initData = (await initRes.json()) as {
    value: { video: string; uploadToken?: string; uploadInstructions: VideoUploadInstruction[] };
  };
  const { video: videoUrn, uploadInstructions } = initData.value;
  const uploadToken = initData.value.uploadToken ?? "";

  const uploadedPartIds: string[] = [];
  for (const part of uploadInstructions) {
    const chunk = bytes.subarray(part.firstByte, part.lastByte + 1);
    const putRes = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: chunk as unknown as BodyInit,
    });
    if (!putRes.ok) {
      throw new Error(`LinkedIn video part upload failed (${putRes.status})`);
    }
    const etag = putRes.headers.get("etag");
    if (!etag) throw new Error("LinkedIn video part upload did not return an ETag.");
    uploadedPartIds.push(etag.replace(/^"|"$/g, ""));
  }

  const finalizeRes = await linkedInAuthorizedFetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...linkedInRestHeaders() },
    body: JSON.stringify({
      finalizeUploadRequest: { video: videoUrn, uploadToken, uploadedPartIds },
    }),
  });
  if (!finalizeRes.ok) {
    const text = await finalizeRes.text().catch(() => "");
    throw new Error(`LinkedIn video finalize failed (${finalizeRes.status}): ${text.slice(0, 300)}`);
  }

  return { videoUrn };
}

/**
 * LinkedIn processes uploaded media asynchronously (WAITING_UPLOAD -> PROCESSING -> AVAILABLE),
 * so creating a post referencing the urn immediately after upload can race processing, especially
 * for video. Polls briefly before returning.
 */
async function waitForMediaAvailable(
  kind: "image" | "video",
  urn: string,
  timeoutMs = 90_000,
): Promise<void> {
  const url = `https://api.linkedin.com/rest/${kind === "image" ? "images" : "videos"}/${encodeURIComponent(urn)}`;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const res = await linkedInAuthorizedFetch(url, { headers: linkedInRestHeaders() });
    if (res.ok) {
      const data = (await res.json()) as { status?: string; processingFailureReason?: string };
      if (data.status === "AVAILABLE") return;
      if (data.status === "PROCESSING_FAILED") {
        throw new Error(`LinkedIn media processing failed: ${data.processingFailureReason ?? "unknown reason"}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("LinkedIn media is still processing after 90s — try publishing again shortly.");
}
