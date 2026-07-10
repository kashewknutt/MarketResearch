import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { snapshots } from "@/lib/db/schema";
import { getCurrentOrg } from "@/lib/auth/session";

export async function getSnapshot<T>(key: string): Promise<T | null> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const rows = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.orgId, orgId), eq(snapshots.key, key)))
    .limit(1);
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].data) as T;
}

export async function saveSnapshot<T>(key: string, data: T): Promise<void> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const payload = JSON.stringify(data);
  const updatedAt = new Date().toISOString();
  const existing = await db
    .select()
    .from(snapshots)
    .where(and(eq(snapshots.orgId, orgId), eq(snapshots.key, key)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(snapshots).values({ orgId, key, data: payload, updatedAt });
  } else {
    await db
      .update(snapshots)
      .set({ data: payload, updatedAt })
      .where(and(eq(snapshots.orgId, orgId), eq(snapshots.key, key)));
  }
}
