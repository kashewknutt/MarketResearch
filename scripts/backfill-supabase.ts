import "dotenv/config";
import Database from "better-sqlite3";
import postgres from "postgres";

const SQLITE_TABLES = [
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

const BOOLEAN_COLUMNS: Record<string, string[]> = {
  api_cost_events: ["used_google_search", "success"],
};

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

async function main() {
  const sqlitePath = "./data/market-research.db";
  const connectionString = process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const superadminEmail = "valneesolutions@gmail.com";

  if (!connectionString) throw new Error("NEXT_SUPABASE_DIRECT_CONNECTION_URL is not set");
  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  console.log(`Resolving UUID for ${superadminEmail}...`);
  const userId = await resolveUserId(supabaseUrl, serviceRoleKey, superadminEmail);
  console.log(`Resolved user_id: ${userId}`);

  const sqlite = new Database(sqlitePath, { readonly: true });
  const sql = postgres(connectionString, { prepare: false });

  try {
    for (const table of SQLITE_TABLES) {
      const rows = sqlite.prepare(`SELECT * FROM ${table}`).all() as Record<string, unknown>[];
      console.log(`${table}: ${rows.length} row(s) found locally`);

      await sql.unsafe(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);

      if (rows.length === 0) continue;

      const boolCols = BOOLEAN_COLUMNS[table] ?? [];
      for (const row of rows) {
        const record: Record<string, unknown> = { ...row, user_id: userId };
        if (table === "app_profile") delete record.id;
        if (table === "ai_logs") delete record.id;
        for (const col of boolCols) {
          record[col] = Boolean(record[col]);
        }

        const columns = Object.keys(record);
        const values = Object.values(record);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        const columnList = columns.map((c) => `"${c}"`).join(", ");
        await sql.unsafe(
          `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`,
          values as never[],
        );
      }
      console.log(`${table}: backfilled ${rows.length} row(s) for user ${userId}`);
    }
    console.log("Backfill complete.");
  } finally {
    sqlite.close();
    await sql.end();
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
