import "dotenv/config";
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

/**
 * Renames user_id -> org_id on every existing table via a plain
 * ALTER TABLE ... RENAME COLUMN, preserving all existing values (the old
 * user UUIDs stay in place under the new column name; seed-valnee-org.ts
 * re-stamps them to the real org id afterwards). This must run BEFORE
 * `drizzle-kit push`, since push's rename-detection heuristic requires an
 * interactive prompt per table — doing the rename ourselves here means the
 * schema and DB already agree on `org_id` by the time push runs, so push
 * only needs to create the new orgs/org_members/assignments tables.
 */
async function main() {
  const connectionString = process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL;
  if (!connectionString) {
    throw new Error("NEXT_SUPABASE_DIRECT_CONNECTION_URL is not set in .env");
  }

  const sql = postgres(connectionString, { prepare: false });

  try {
    for (const table of TABLES) {
      const columns = await sql`
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = ${table}
      `;
      const names = columns.map((c) => c.column_name as string);

      if (names.includes("org_id")) {
        console.log(`${table}: org_id already present, skipping`);
        continue;
      }
      if (!names.includes("user_id")) {
        console.log(`${table}: no user_id column found, skipping`);
        continue;
      }

      await sql.unsafe(`ALTER TABLE ${table} RENAME COLUMN user_id TO org_id`);
      console.log(`${table}: renamed user_id -> org_id`);
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
