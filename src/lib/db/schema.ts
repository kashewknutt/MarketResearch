import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const appProfile = sqliteTable("app_profile", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const researchJobs = sqliteTable("research_jobs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  stages: text("stages").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
});

export const demandSignals = sqliteTable("demand_signals", {
  id: text("id").primaryKey(),
  region: text("region").notNull(),
  rank: integer("rank").notNull(),
  data: text("data").notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  region: text("region").notNull(),
  status: text("status").notNull(),
  data: text("data").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const snapshots = sqliteTable("snapshots", {
  key: text("key").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const aiLogs = sqliteTable("ai_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  task: text("task").notNull(),
  prompt: text("prompt").notNull(),
  response: text("response"),
  costEventId: text("cost_event_id"),
  createdAt: text("created_at").notNull(),
});

export const pricingSnapshots = sqliteTable("pricing_snapshots", {
  id: text("id").primaryKey(),
  model: text("model").notNull(),
  data: text("data").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  region: text("region").notNull(),
  status: text("status").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull(),
});

export const researchArtifacts = sqliteTable("research_artifacts", {
  id: text("id").primaryKey(),
  jobId: text("job_id").notNull(),
  stageId: text("stage_id").notNull(),
  stepId: text("step_id").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull(),
});

export const apiCostEvents = sqliteTable("api_cost_events", {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull(),
  operation: text("operation").notNull(),
  category: text("category").notNull(),
  correlationId: text("correlation_id"),
  region: text("region"),
  researchStage: text("research_stage"),
  model: text("model").notNull(),
  usedGoogleSearch: integer("used_google_search", { mode: "boolean" }).notNull(),
  success: integer("success", { mode: "boolean" }).notNull(),
  errorMessage: text("error_message"),
  durationMs: integer("duration_ms").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  thinkingTokens: integer("thinking_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  searchQueryCount: integer("search_query_count").notNull(),
  searchQueries: text("search_queries").notNull(),
  costInputUsd: real("cost_input_usd").notNull(),
  costOutputUsd: real("cost_output_usd").notNull(),
  costThinkingUsd: real("cost_thinking_usd").notNull(),
  costSearchUsd: real("cost_search_usd").notNull(),
  costTotalUsd: real("cost_total_usd").notNull(),
  pricingSnapshotId: text("pricing_snapshot_id").notNull(),
  billingTier: text("billing_tier").notNull(),
  promptPreview: text("prompt_preview").notNull(),
  metadata: text("metadata").notNull(),
});
