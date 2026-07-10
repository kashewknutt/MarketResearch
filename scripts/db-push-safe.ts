import "dotenv/config";
import { spawnSync } from "child_process";
import readline from "readline";
import postgres from "postgres";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../src/lib/db/schema";

interface SchemaColumn {
  name: string;
  notNull: boolean;
}

interface SchemaTable {
  name: string;
  columns: SchemaColumn[];
}

function loadSchemaTables(): SchemaTable[] {
  const tables: SchemaTable[] = [];
  for (const value of Object.values(schema)) {
    if (!is(value, PgTable)) continue;
    const config = getTableConfig(value);
    tables.push({
      name: config.name,
      columns: config.columns.map((c) => ({ name: c.name, notNull: c.notNull })),
    });
  }
  return tables.sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const connectionString = process.env.NEXT_SUPABASE_DIRECT_CONNECTION_URL;
  if (!connectionString) {
    throw new Error("NEXT_SUPABASE_DIRECT_CONNECTION_URL is not set in .env");
  }

  const sql = postgres(connectionString, { prepare: false });
  const schemaTables = loadSchemaTables();

  console.log("Comparing src/lib/db/schema.ts against the live database...\n");

  const liveTableNames = (
    await sql`select table_name from information_schema.tables where table_schema = 'public'`
  ).map((r) => r.table_name as string);

  const newTables: string[] = [];
  const addedColumns: Array<{ table: string; column: string; notNull: boolean; existingRows: number }> = [];
  const droppedColumns: Array<{ table: string; column: string; nonNullValues: number }> = [];
  const tablesWithData: Array<{ table: string; rows: number }> = [];
  const orphanTables = liveTableNames.filter(
    (t) => !schemaTables.some((s) => s.name === t) && t !== "profiles",
  );

  for (const table of schemaTables) {
    if (!liveTableNames.includes(table.name)) {
      newTables.push(table.name);
      continue;
    }

    const liveColumns = (
      await sql`
        select column_name from information_schema.columns
        where table_schema = 'public' and table_name = ${table.name}
      `
    ).map((r) => r.column_name as string);

    const [{ count: rowCountRaw }] = await sql.unsafe(
      `select count(*) as count from "${table.name}"`,
    );
    const rowCount = Number(rowCountRaw);
    if (rowCount > 0) tablesWithData.push({ table: table.name, rows: rowCount });

    for (const col of table.columns) {
      if (!liveColumns.includes(col.name)) {
        addedColumns.push({
          table: table.name,
          column: col.name,
          notNull: col.notNull,
          existingRows: rowCount,
        });
      }
    }

    for (const liveCol of liveColumns) {
      if (!table.columns.some((c) => c.name === liveCol)) {
        const [{ nonnull: nonNullRaw }] = await sql.unsafe(
          `select count("${liveCol}") as nonnull from "${table.name}"`,
        );
        droppedColumns.push({
          table: table.name,
          column: liveCol,
          nonNullValues: Number(nonNullRaw),
        });
      }
    }
  }

  await sql.end();

  console.log("== New tables (will be created) ==");
  console.log(newTables.length ? newTables.map((t) => `  + ${t}`).join("\n") : "  (none)");

  console.log("\n== New columns (will be added) ==");
  if (addedColumns.length === 0) {
    console.log("  (none)");
  } else {
    for (const c of addedColumns) {
      const risk =
        c.notNull && c.existingRows > 0
          ? `  ⚠ NOT NULL with no default — will FAIL unless every existing row (${c.existingRows}) gets a value`
          : "";
      console.log(`  + ${c.table}.${c.column}${risk}`);
    }
  }

  console.log("\n== Columns that would be DROPPED (data loss) ==");
  if (droppedColumns.length === 0) {
    console.log("  (none)");
  } else {
    for (const c of droppedColumns) {
      const warn = c.nonNullValues > 0 ? `  ⚠ ${c.nonNullValues} row(s) currently hold data here` : "  (currently empty)";
      console.log(`  - ${c.table}.${c.column}${warn}`);
    }
  }

  console.log("\n== Tables with existing data (informational) ==");
  console.log(
    tablesWithData.length
      ? tablesWithData.map((t) => `  ${t.table}: ${t.rows} row(s)`).join("\n")
      : "  (no tables currently have rows)",
  );

  if (orphanTables.length > 0) {
    console.log("\n== Tables in the database not defined in schema.ts (untouched by this push) ==");
    console.log(orphanTables.map((t) => `  ? ${t}`).join("\n"));
  }

  const hasDataLoss = droppedColumns.some((c) => c.nonNullValues > 0);
  const hasRisk = addedColumns.some((c) => c.notNull && c.existingRows > 0);

  console.log("");
  if (hasDataLoss) {
    console.log("⚠ This push would DELETE data (columns above with non-zero row counts).");
  }
  if (hasRisk) {
    console.log("⚠ This push includes a NOT NULL column addition that may fail against existing rows.");
  }
  if (!hasDataLoss && !hasRisk && newTables.length === 0 && addedColumns.length === 0) {
    console.log("No schema changes detected.");
  }

  if (!process.stdin.isTTY) {
    console.log(
      "\nNot running in an interactive terminal — stopping here without pushing. " +
        "Re-run `npm run db:push` from a real terminal to review and confirm.",
    );
    return;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => {
    rl.question("\nProceed with `drizzle-kit push`? (yes/N) ", resolve);
  });
  rl.close();

  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Aborted. No changes were applied.");
    return;
  }

  console.log("\nRunning drizzle-kit push (you'll still see its own per-statement confirmations)...\n");
  const result = spawnSync("npx", ["drizzle-kit", "push", "--strict"], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
