import "dotenv/config";
import { randomUUID } from "crypto";
import postgres from "postgres";

const TABLES = [
  "app_profile",
  "research_jobs",
  "demand_signals",
  "projects",
  "snapshots",
  "ai_logs",
  "pricing_snapshots",
  "leads",
  "research_artifacts",
  "api_cost_events",
] as const;

async function resolveUserId(supabaseUrl: string, serviceRoleKey: string, email: string) {
  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to look up user by email: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { users: Array<{ id: string; email: string }> };
  const user = body.users.find((u) => u.email === email);
  if (!user) {
    throw new Error(`No auth.users row found for email ${email}`);
  }
  return user.id;
}

/**
 * Idempotent, one-time setup: creates the Valnee org owned by the
 * superadmin, adds the owner membership row, and re-stamps every existing
 * row (currently holding the superadmin's user id in the org_id column,
 * after scripts/rename-user-id-to-org-id.ts ran) to the real org id.
 * Must run AFTER `npm run db:push` (needs the orgs/org_members tables to
 * exist) and AFTER scripts/rename-user-id-to-org-id.ts.
 */
async function main() {
  const connectionString = process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const superadminEmail = "valneesolutions@gmail.com";

  if (!connectionString) throw new Error("NEXT_SUPABASE_DIRECT_CONNECTION_URL is not set");
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  console.log(`Resolving UUID for ${superadminEmail}...`);
  const ownerId = await resolveUserId(supabaseUrl, serviceRoleKey, superadminEmail);
  console.log(`Resolved owner user_id: ${ownerId}`);

  const sql = postgres(connectionString, { prepare: false });

  try {
    const existingOrg = await sql`select id from orgs where slug = 'valnee' limit 1`;
    let orgId: string;

    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id as string;
      console.log(`Valnee org already exists: ${orgId}`);
    } else {
      orgId = randomUUID();
      await sql`
        insert into orgs (id, name, slug, owner_id, created_at)
        values (${orgId}, 'Valnee', 'valnee', ${ownerId}, ${new Date().toISOString()})
      `;
      console.log(`Created Valnee org: ${orgId}`);
    }

    const existingMembership = await sql`
      select 1 from org_members where org_id = ${orgId} and user_id = ${ownerId}
    `;
    if (existingMembership.length === 0) {
      await sql`
        insert into org_members (org_id, user_id, role, invited_by, joined_at)
        values (${orgId}, ${ownerId}, 'owner', null, ${new Date().toISOString()})
      `;
      console.log("Added owner membership");
    } else {
      console.log("Owner membership already exists");
    }

    for (const table of TABLES) {
      const result = await sql.unsafe(
        `UPDATE ${table} SET org_id = $1 WHERE org_id = $2`,
        [orgId, ownerId],
      );
      console.log(`${table}: re-stamped ${result.count} row(s) to org ${orgId}`);
    }

    console.log("Done.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
