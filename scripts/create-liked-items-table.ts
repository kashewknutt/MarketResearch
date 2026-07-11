import "dotenv/config";
import postgres from "postgres";

const SQL = `
create table if not exists liked_items (
  org_id uuid not null,
  user_id uuid not null,
  entity_type text not null,
  entity_id text not null,
  created_at text not null,
  primary key (org_id, user_id, entity_type, entity_id)
);
`;

/**
 * Creates liked_items directly via raw SQL, same reasoning as
 * scripts/create-org-tables.ts — drizzle-kit push's diff/introspection
 * gets confused once the DB already has data alongside genuinely new
 * tables. Idempotent to re-run.
 */
async function main() {
  const connectionString = process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL;
  if (!connectionString) {
    throw new Error("NEXT_SUPABASE_DIRECT_CONNECTION_URL is not set in .env");
  }

  const sql = postgres(connectionString, { prepare: false });

  try {
    await sql.unsafe(SQL);
    console.log("Created liked_items (or already existed).");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
