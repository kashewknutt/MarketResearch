import { isGeminiApiError } from "@/lib/ai/gemini-errors";
import { GooglePlacesApiError } from "@/lib/integrations/google-places";
import {
  discoverColdCallLeads,
  MAX_COLD_CALL_FETCH_COUNT,
} from "@/lib/research/stages/cold-call-leads";
import { getProfile } from "@/lib/store/settings";

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const city = requiredString(body.city);
  const region = requiredString(body.region);
  const keyword = requiredString(body.keyword);
  const campaignContext = requiredString(body.campaignContext);
  const count = Number(body.count);

  if (
    !city ||
    !region ||
    !keyword ||
    !campaignContext ||
    !Number.isFinite(count) ||
    count < 1 ||
    count > MAX_COLD_CALL_FETCH_COUNT
  ) {
    return Response.json(
      {
        error: `city, region, keyword, campaignContext, and a count between 1 and ${MAX_COLD_CALL_FETCH_COUNT} are required`,
      },
      { status: 400 },
    );
  }

  console.log(
    `[cold-call] request received: region=${region} city=${city} keyword=${keyword} count=${count}`,
  );

  const profile = await getProfile();
  if (!profile) {
    console.warn("[cold-call] no onboarding profile found — aborting");
    return Response.json(
      { error: "Complete onboarding before fetching cold-call leads" },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const leads = await discoverColdCallLeads(
          profile,
          { city, region, keyword, campaignContext, count: Math.floor(count) },
          (progress) => {
            console.log(
              `[cold-call] progress: ${progress.completed}/${progress.total} — "${progress.title}"`,
            );
            send({ type: "progress", ...progress });
          },
        );
        console.log(`[cold-call] complete: ${leads.length} lead(s) saved`);
        send({ type: "complete", leads });
      } catch (err) {
        console.error("[cold-call] pipeline threw:", err);
        if (err instanceof GooglePlacesApiError) {
          console.error(`[cold-call] Google Places error (${err.code}): ${err.message}`);
          send({ type: "error", error: err.code, message: err.userMessage });
        } else if (isGeminiApiError(err)) {
          console.error(`[cold-call] Gemini error (${err.code}): ${err.message}`);
          send({ type: "error", error: err.code, message: err.userMessage });
        } else {
          const message = err instanceof Error ? err.message : "Could not fetch cold-call leads";
          console.error(`[cold-call] unclassified error: ${message}`);
          send({ type: "error", error: "unknown", message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
