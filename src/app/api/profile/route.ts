import { NextResponse } from "next/server";
import { getProfile, normalizeProfile, saveProfile } from "@/lib/store/settings";
import type { OnboardingProfile } from "@/lib/types/domain";

export async function GET() {
  const profile = await getProfile();
  return NextResponse.json({ profile });
}

export async function POST(request: Request) {
  const body = normalizeProfile(
    (await request.json()) as OnboardingProfile & { goalRevenue?: number },
  );
  const profile: OnboardingProfile = {
    ...body,
    completedAt: body.completedAt ?? new Date().toISOString(),
  };
  await saveProfile(profile);
  return NextResponse.json({ profile });
}

export async function PATCH(request: Request) {
  const existing = await getProfile();
  if (!existing) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }
  const body = (await request.json()) as Partial<OnboardingProfile> & {
    goalRevenue?: number;
  };
  const profile = normalizeProfile({ ...existing, ...body });
  await saveProfile(profile);
  return NextResponse.json({ profile });
}
