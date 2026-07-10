import "dotenv/config";
import postgres from "postgres";

const SQL = `
create table if not exists orgs (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  owner_id uuid not null,
  created_at text not null
);

create table if not exists org_members (
  org_id uuid not null,
  user_id uuid not null,
  role text not null,
  invited_by uuid,
  joined_at text not null,
  primary key (org_id, user_id)
);

create table if not exists assignments (
  id text primary key,
  org_id uuid not null,
  entity_type text not null,
  entity_id text,
  assignee_user_id uuid not null,
  assigned_by_user_id uuid not null,
  title text not null,
  notes text,
  status text not null,
  created_at text not null,
  updated_at text not null
);
`;

/**
 * Creates orgs/org_members/assignments directly via raw SQL rather than
 * `drizzle-kit push`. In this environment, push's diff/introspection got
 * confused once some tables already existed (from the earlier org_id
 * rename) while a few were genuinely new — it planned CREATE TABLE
 * statements against tables that already existed. Raw SQL with
 * IF NOT EXISTS sidesteps that entirely and is idempotent to re-run.
 */
async function main() {
  const connectionString = process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL;
  if (!connectionString) {
    throw new Error("NEXT_SUPABASE_DIRECT_CONNECTION_URL is not set in .env");
  }

  const sql = postgres(connectionString, { prepare: false });

  try {
    await sql.unsafe(SQL);
    console.log("Created orgs, org_members, assignments (or already existed).");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
