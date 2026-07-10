import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { snapshots } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";

export async function getSnapshot<T>(key: string): Promise<T | null> {
  const userId = await getCurrentUserId();
  const db = getDb();
  const rows = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.userId, userId), eq(snapshots.key, key)))
    .limit(1);
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].data) as T;
}

export async function saveSnapshot<T>(key: string, data: T): Promise<void> {
  const userId = await getCurrentUserId();
  const db = getDb();
  const payload = JSON.stringify(data);
  const updatedAt = new Date().toISOString();
  const existing = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.userId, userId), eq(snapshots.key, key)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(snapshots).values({ userId, key, data: payload, updatedAt });
  } else {
    await db
      .update(snapshots)
      .set({ data: payload, updatedAt })
      .where(and(eq(snapshots.userId, userId), eq(snapshots.key, key)));
  }
}
