import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/db/client";
import { orgMembers } from "@/lib/db/schema";

/**
 * Resolves the current logged-in user's UUID for identity/audit purposes
 * (assignments.assigneeUserId, orgMembers.userId, etc). Middleware
 * (src/proxy.ts) already redirects unauthenticated requests to /login
 * before any store module runs, so the "no session" branch here should be
 * unreachable in practice — it throws rather than silently falling back to
 * a shared/default user.
 */
export async function getCurrentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    throw new Error("No authenticated user found — cannot resolve user_id for DB access");
  }

  return userId;
}

export interface CurrentOrg {
  orgId: string;
  role: "owner" | "member";
}

/**
 * Resolves the current user's organization for scoping DB reads/writes.
 * Every table's tenant boundary is org_id, not user_id — a user is
 * expected to belong to exactly one org for now (no org-switcher UI yet),
 * so the first membership row found is used. Throws if the user has no
 * org membership, since every logged-in user should have been added to an
 * org (via the seed script or the Team page) before using the app.
 */
export async function getCurrentOrg(): Promise<CurrentOrg> {
  const userId = await getCurrentUserId();
  const db = getDb();
  const rows = await db
    .select()
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    throw new Error("No organization membership found for the current user");
  }

  return { orgId: rows[0].orgId, role: rows[0].role as "owner" | "member" };
}
