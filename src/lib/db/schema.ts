import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  serial,
  uuid,
  primaryKey,
} from "drizzle-orm/pg-core";

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  ownerId: uuid("owner_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(),
    invitedBy: uuid("invited_by"),
    joinedAt: text("joined_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.orgId, table.userId] })],
);

export const assignments = pgTable("assignments", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  assigneeUserId: uuid("assignee_user_id").notNull(),
  assignedByUserId: uuid("assigned_by_user_id").notNull(),
  title: text("title").notNull(),
  notes: text("notes"),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const appProfile = pgTable("app_profile", {
  orgId: uuid("org_id").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const researchJobs = pgTable("research_jobs", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  status: text("status").notNull(),
  stages: text("stages").notNull(),
  startedAt: text("started_at").notNull(),
  completedAt: text("completed_at"),
});

export const demandSignals = pgTable("demand_signals", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  region: text("region").notNull(),
  rank: integer("rank").notNull(),
  data: text("data").notNull(),
});

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  region: text("region").notNull(),
  status: text("status").notNull(),
  data: text("data").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const snapshots = pgTable(
  "snapshots",
  {
    orgId: uuid("org_id").notNull(),
    key: text("key").notNull(),
    data: text("data").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.orgId, table.key] })],
);

export const aiLogs = pgTable("ai_logs", {
  id: serial("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  task: text("task").notNull(),
  prompt: text("prompt").notNull(),
  response: text("response"),
  costEventId: text("cost_event_id"),
  createdAt: text("created_at").notNull(),
});

export const pricingSnapshots = pgTable("pricing_snapshots", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  model: text("model").notNull(),
  data: text("data").notNull(),
  fetchedAt: text("fetched_at").notNull(),
});

export const leads = pgTable("leads", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  region: text("region").notNull(),
  status: text("status").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull(),
});

export const researchArtifacts = pgTable("research_artifacts", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  jobId: text("job_id").notNull(),
  stageId: text("stage_id").notNull(),
  stepId: text("step_id").notNull(),
  data: text("data").notNull(),
  createdAt: text("created_at").notNull(),
});

export const apiCostEvents = pgTable("api_cost_events", {
  id: text("id").primaryKey(),
  orgId: uuid("org_id").notNull(),
  createdAt: text("created_at").notNull(),
  operation: text("operation").notNull(),
  category: text("category").notNull(),
  correlationId: text("correlation_id"),
  region: text("region"),
  researchStage: text("research_stage"),
  model: text("model").notNull(),
  usedGoogleSearch: boolean("used_google_search").notNull(),
  success: boolean("success").notNull(),
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
