import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Mirrors the `public.profiles` table created directly in Supabase Postgres
 * (see scripts/setup-profiles-table.ts) — auto-populated by a trigger on
 * `auth.users` insert. Kept separate from src/lib/db/schema.ts (still SQLite)
 * until the full Postgres migration lands; this is Drizzle-typed access to a
 * table that already exists in the live database, not something `db:push`
 * needs to create.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});
