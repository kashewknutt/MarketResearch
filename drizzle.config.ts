import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.MARKET_RESEARCH_DATA_DIR
      ? `${process.env.MARKET_RESEARCH_DATA_DIR}/market-research.db`
      : "./data/market-research.db",
  },
});
