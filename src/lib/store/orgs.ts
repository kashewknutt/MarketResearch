import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orgMembers, orgs } from "@/lib/db/schema";
import { getProfileByEmail, getProfilesByIds } from "@/lib/store/profiles";

export interface OrgMemberInfo {
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
  email: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}

export async function getOrg(orgId: string) {
  const db = getDb();
  const rows = await db.select().from(orgs).where(eq(orgs.id, orgId)).limit(1);
  return rows[0] ?? null;
}

export async function getOrgMembers(orgId: string): Promise<OrgMemberInfo[]> {
  const db = getDb();
  const members = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.orgId, orgId));

  const profiles = await getProfilesByIds(members.map((m) => m.userId));
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  return members
    .map((m) => {
      const profile = profileById.get(m.userId);
      return {
        userId: m.userId,
        role: m.role as "owner" | "member",
        joinedAt: m.joinedAt,
        email: profile?.email ?? null,
        fullName: profile?.fullName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      };
    })
    .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
}

export class MemberNotRegisteredError extends Error {
  constructor(email: string) {
    super(`No account found for ${email}. Ask them to log in with Google first, then try again.`);
    this.name = "MemberNotRegisteredError";
  }
}

export async function addMemberByEmail(
  orgId: string,
  email: string,
  invitedBy: string,
  role: "owner" | "member" = "member",
): Promise<OrgMemberInfo> {
  const profile = await getProfileByEmail(email);
  if (!profile) {
    throw new MemberNotRegisteredError(email);
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, profile.id)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(orgMembers).values({
      orgId,
      userId: profile.id,
      role,
      invitedBy,
      joinedAt: new Date().toISOString(),
    });
  }

  return {
    userId: profile.id,
    role,
    joinedAt: existing[0]?.joinedAt ?? new Date().toISOString(),
    email: profile.email,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
  };
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
}
