import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the current logged-in user's UUID for scoping DB reads/writes.
 * Middleware (src/proxy.ts) already redirects unauthenticated requests to
 * /login before any store module runs, so the "no session" branch here
 * should be unreachable in practice — it throws rather than silently
 * falling back to a shared/default user.
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
