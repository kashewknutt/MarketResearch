import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!dbInstance) {
    const connectionString = process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL;
    if (!connectionString) {
      throw new Error("NEXT_SUPABASE_DIRECT_CONNECTION_URL is not set");
    }
    const client = postgres(connectionString, { prepare: false });
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}
