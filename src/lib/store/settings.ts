import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { DEFAULT_CURRENCY, normalizeCurrency } from "@/lib/currency";
import { appProfile } from "@/lib/db/schema";
import type { OnboardingProfile } from "@/lib/types/domain";

type StoredProfile = OnboardingProfile & { goalRevenue?: number };

export function normalizeProfile(raw: StoredProfile): OnboardingProfile {
  return {
    ...raw,
    socialLinks: raw.socialLinks ?? [],
    currency: normalizeCurrency(raw.currency ?? DEFAULT_CURRENCY),
    targetMrr: raw.targetMrr ?? raw.goalRevenue ?? 0,
  };
}

export async function getProfile(): Promise<OnboardingProfile | null> {
  const db = getDb();
  const rows = await db.select().from(appProfile).limit(1);
  if (rows.length === 0) return null;
  return normalizeProfile(JSON.parse(rows[0].data) as StoredProfile);
}

export async function saveProfile(profile: OnboardingProfile): Promise<void> {
  const db = getDb();
  const data = JSON.stringify(normalizeProfile(profile));
  const updatedAt = new Date().toISOString();
  const existing = await db.select().from(appProfile).limit(1);
  if (existing.length === 0) {
    await db.insert(appProfile).values({ data, updatedAt });
  } else {
    await db
      .update(appProfile)
      .set({ data, updatedAt })
      .where(eq(appProfile.id, existing[0].id));
  }
}

export async function isOnboardingComplete(): Promise<boolean> {
  const profile = await getProfile();
  return Boolean(profile?.completedAt);
}
