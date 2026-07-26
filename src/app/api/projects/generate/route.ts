import { NextResponse } from "next/server";
import { isGeminiApiError } from "@/lib/ai/gemini-errors";
import { fetchProjectsOnDemand } from "@/lib/research/project-generator";
import { getProfile } from "@/lib/store/settings";

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const region = requiredString(body.region);
  const count = Number(body.count);

  if (!region || !Number.isFinite(count) || count < 1 || count > 50) {
    return NextResponse.json(
      { error: "region and a count between 1 and 50 are required" },
      { status: 400 },
    );
  }

  const baseProfile = await getProfile();
  if (!baseProfile) {
    return NextResponse.json({ error: "Complete onboarding before fetching projects" }, { status: 400 });
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

  try {
    const projects = await fetchProjectsOnDemand(profile, region, Math.floor(count));
    return NextResponse.json({ projects }, { status: 201 });
  } catch (err) {
    if (isGeminiApiError(err)) {
      return NextResponse.json(
        { error: err.code, message: err.userMessage },
        { status: 503 },
      );
    }
    throw err;
  }
}
