import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { getDbPath } from "./paths";

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

function migrate(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS research_jobs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      stages TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS demand_signals (
      id TEXT PRIMARY KEY,
      region TEXT NOT NULL,
      rank INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      region TEXT NOT NULL,
      status TEXT NOT NULL,
      data TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS snapshots (
      key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT,
      cost_event_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pricing_snapshots (
      id TEXT PRIMARY KEY,
      model TEXT NOT NULL,
      data TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_cost_events (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      operation TEXT NOT NULL,
      category TEXT NOT NULL,
      correlation_id TEXT,
      region TEXT,
      research_stage TEXT,
      model TEXT NOT NULL,
      used_google_search INTEGER NOT NULL,
      success INTEGER NOT NULL,
      error_message TEXT,
      duration_ms INTEGER NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      thinking_tokens INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      search_query_count INTEGER NOT NULL,
      search_queries TEXT NOT NULL,
      cost_input_usd REAL NOT NULL,
      cost_output_usd REAL NOT NULL,
      cost_thinking_usd REAL NOT NULL,
      cost_search_usd REAL NOT NULL,
      cost_total_usd REAL NOT NULL,
      pricing_snapshot_id TEXT NOT NULL,
      billing_tier TEXT NOT NULL,
      prompt_preview TEXT NOT NULL,
      metadata TEXT NOT NULL
    );
  `);

  migrateAiLogsCostColumn(sqlite);
}

function migrateAiLogsCostColumn(sqlite: Database.Database) {
  const columns = sqlite
    .prepare("PRAGMA table_info(ai_logs)")
    .all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === "cost_event_id")) {
    sqlite.exec("ALTER TABLE ai_logs ADD COLUMN cost_event_id TEXT");
  }
}

export function getDb() {
  if (!dbInstance) {
    const dbPath = getDbPath();
    ensureDir(path.dirname(dbPath));
    const sqlite = new Database(dbPath);
    migrate(sqlite);
    dbInstance = drizzle(sqlite, { schema });
  }
  return dbInstance;
}
