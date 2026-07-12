import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL!,
  },
  // `profiles` is a Supabase-managed table (tied to auth.users), not defined in schema.ts.
  // Without this, drizzle-kit push treats it as extraneous and offers to drop it.
  tablesFilter: ["!profiles"],
});
