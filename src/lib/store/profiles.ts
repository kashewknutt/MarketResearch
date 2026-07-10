import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/profiles-schema";

export interface Profile {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.email, email))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl,
  };
}

export async function getProfilesByIds(ids: string[]): Promise<Profile[]> {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db.select().from(profiles).where(inArray(profiles.id, ids));
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    avatarUrl: row.avatarUrl,
  }));
}
