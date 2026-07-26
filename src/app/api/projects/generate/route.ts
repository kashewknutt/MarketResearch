import { isGeminiApiError } from "@/lib/ai/gemini-errors";
import {
  fetchProjectsOnDemand,
  MAX_ON_DEMAND_FETCH_COUNT,
} from "@/lib/research/project-generator";
import { getProfile } from "@/lib/store/settings";

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const region = requiredString(body.region);
  const count = Number(body.count);

  if (!region || !Number.isFinite(count) || count < 1 || count > MAX_ON_DEMAND_FETCH_COUNT) {
    return Response.json(
      {
        error: `region and a count between 1 and ${MAX_ON_DEMAND_FETCH_COUNT} are required`,
      },
      { status: 400 },
    );
  }

  const baseProfile = await getProfile();
  if (!baseProfile) {
    return Response.json(
      { error: "Complete onboarding before fetching projects" },
      { status: 400 },
    );
  }

  const serviceDomain = requiredString(body.serviceDomain);
  const targetAudience = requiredString(body.targetAudience);
  const constraints = requiredString(body.constraints);
  const strategicGoals = requiredString(body.strategicGoals);

  const profile = {
    ...baseProfile,
    ...(serviceDomain ? { serviceDomain } : {}),
    ...(targetAudience ? { targetAudience } : {}),
    ...(constraints ? { constraints } : {}),
    ...(strategicGoals ? { strategicGoals } : {}),
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const projects = await fetchProjectsOnDemand(
          profile,
          region,
          Math.floor(count),
          (progress) => send({ type: "progress", ...progress }),
        );
        send({ type: "complete", projects });
      } catch (err) {
        if (isGeminiApiError(err)) {
          send({ type: "error", error: err.code, message: err.userMessage });
        } else {
          const message = err instanceof Error ? err.message : "Could not fetch projects";
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
