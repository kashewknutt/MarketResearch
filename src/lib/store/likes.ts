import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { likedItems } from "@/lib/db/schema";
import { getProfilesByIds } from "@/lib/store/profiles";
import type { AssignmentEntityType } from "@/lib/store/assignments";

export type LikeEntityType = AssignmentEntityType | "task";

export interface LikeSummary {
  count: number;
  likedByMe: boolean;
  likedBy: Array<{ userId: string; fullName: string | null; email: string | null }>;
}

export async function toggleLike(
  orgId: string,
  userId: string,
  entityType: LikeEntityType,
  entityId: string,
): Promise<boolean> {
  const db = getDb();
  const where = and(
    eq(likedItems.orgId, orgId),
    eq(likedItems.userId, userId),
    eq(likedItems.entityType, entityType),
    eq(likedItems.entityId, entityId),
  );

  const existing = await db.select().from(likedItems).where(where).limit(1);

  if (existing.length > 0) {
    await db.delete(likedItems).where(where);
    return false;
  }

  await db.insert(likedItems).values({
    orgId,
    userId,
    entityType,
    entityId,
    createdAt: new Date().toISOString(),
  });
  return true;
}

export async function getLikeSummary(
  orgId: string,
  entityType: LikeEntityType,
  entityId: string,
  currentUserId: string,
): Promise<LikeSummary> {
  const db = getDb();
  const rows = await db
    .select()
    .from(likedItems)
    .where(
      and(
        eq(likedItems.orgId, orgId),
        eq(likedItems.entityType, entityType),
        eq(likedItems.entityId, entityId),
      ),
    );

  const profiles = await getProfilesByIds(rows.map((r) => r.userId));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return {
    count: rows.length,
    likedByMe: rows.some((r) => r.userId === currentUserId),
    likedBy: rows.map((r) => {
      const profile = profileById.get(r.userId);
      return {
        userId: r.userId,
        fullName: profile?.fullName ?? null,
        email: profile?.email ?? null,
      };
    }),
  };
}
