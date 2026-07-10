import { randomUUID } from "crypto";
import { getDb } from "@/lib/db/client";
import { apiCostEvents, pricingSnapshots } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";
import { and, desc, eq, sql } from "drizzle-orm";
import type {
  AiCallTrace,
  ApiCostEventRecord,
  CostBreakdown,
  ModelPricingRates,
} from "@/lib/ai/pricing-types";
import { fetchLivePricing, getBillingTier } from "@/lib/ai/pricing";
import { GEMINI_MODEL } from "@/lib/ai/constants";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";

const SEARCH_QUOTA_KEY = "search_query_quota";

interface UsageFromResponse {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  searchQueries: string[];
}

interface GenerateContentLikeResponse {
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
  candidates?: Array<{
    groundingMetadata?: {
      webSearchQueries?: string[];
    };
  }>;
}

function monthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getMonthlySearchUsage(): Promise<number> {
  const record = await getSnapshot<{ month: string; count: number }>(
    SEARCH_QUOTA_KEY,
  );
  const current = monthKey();
  if (!record || record.month !== current) return 0;
  return record.count;
}

async function addMonthlySearchUsage(queryCount: number): Promise<number> {
  const current = monthKey();
  const existing = await getMonthlySearchUsage();
  const next = existing + queryCount;
  await saveSnapshot(SEARCH_QUOTA_KEY, { month: current, count: next });
  return next;
}

export function extractUsageFromResponse(
  response: GenerateContentLikeResponse,
): UsageFromResponse {
  const usage = response.usageMetadata;
  const searchQueries =
    response.candidates?.[0]?.groundingMetadata?.webSearchQueries?.filter(
      (q) => q.trim().length > 0,
    ) ?? [];

  const inputTokens = usage?.promptTokenCount ?? 0;
  const outputTokens = usage?.candidatesTokenCount ?? 0;
  const thinkingTokens = usage?.thoughtsTokenCount ?? 0;
  const totalTokens =
    usage?.totalTokenCount ?? inputTokens + outputTokens + thinkingTokens;

  return {
    inputTokens,
    outputTokens,
    thinkingTokens,
    totalTokens,
    searchQueries,
  };
}

export function calculateCost(
  usage: UsageFromResponse,
  pricing: ModelPricingRates,
  billingTier: "paid" | "free",
  monthlySearchQueriesBefore: number,
): CostBreakdown {
  if (billingTier === "free") {
    return {
      inputUsd: 0,
      outputUsd: 0,
      thinkingUsd: 0,
      searchUsd: 0,
      totalUsd: 0,
    };
  }

  const inputUsd =
    (usage.inputTokens / 1_000_000) * pricing.inputPerMillionUsd;
  const outputUsd =
    (usage.outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
  const thinkingUsd =
    (usage.thinkingTokens / 1_000_000) * pricing.outputPerMillionUsd;

  let searchUsd = 0;
  const queryCount = usage.searchQueries.length;
  if (queryCount > 0) {
    let billable = 0;
    let remainingFree = Math.max(
      0,
      pricing.freeSearchQueriesPerMonth - monthlySearchQueriesBefore,
    );
    for (let i = 0; i < queryCount; i++) {
      if (remainingFree > 0) {
        remainingFree -= 1;
      } else {
        billable += 1;
      }
    }
    searchUsd =
      (billable / 1000) * pricing.searchPerThousandQueriesUsd;
  }

  const totalUsd = inputUsd + outputUsd + thinkingUsd + searchUsd;

  return {
    inputUsd,
    outputUsd,
    thinkingUsd,
    searchUsd,
    totalUsd,
  };
}

async function savePricingSnapshot(
  pricing: ModelPricingRates,
): Promise<string> {
  const id = randomUUID();
  const userId = await getCurrentUserId();
  const db = getDb();
  await db.insert(pricingSnapshots).values({
    id,
    userId,
    model: pricing.modelId,
    data: JSON.stringify(pricing),
    fetchedAt: pricing.fetchedAt,
  });
  return id;
}

export interface RecordCostInput {
  trace: AiCallTrace;
  response?: GenerateContentLikeResponse;
  usedGoogleSearch: boolean;
  success: boolean;
  errorMessage?: string;
  durationMs: number;
  promptPreview: string;
  pricing?: ModelPricingRates;
}

export async function recordApiCostEvent(
  input: RecordCostInput,
): Promise<ApiCostEventRecord> {
  const pricing = input.pricing ?? (await fetchLivePricing(GEMINI_MODEL));
  const pricingSnapshotId = await savePricingSnapshot(pricing);
  const billingTier = getBillingTier();

  const usage = input.response
    ? extractUsageFromResponse(input.response)
    : {
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
        searchQueries: [] as string[],
      };

  const monthlyBefore = await getMonthlySearchUsage();
  const costs = calculateCost(usage, pricing, billingTier, monthlyBefore);

  if (usage.searchQueries.length > 0) {
    await addMonthlySearchUsage(usage.searchQueries.length);
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const metadata = input.trace.metadata ?? {};

  const userId = await getCurrentUserId();
  const db = getDb();
  await db.insert(apiCostEvents).values({
    id,
    userId,
    createdAt,
    operation: input.trace.operation,
    category: input.trace.category,
    correlationId: input.trace.correlationId ?? null,
    region: input.trace.region ?? null,
    researchStage: input.trace.researchStage ?? null,
    model: GEMINI_MODEL,
    usedGoogleSearch: input.usedGoogleSearch,
    success: input.success,
    errorMessage: input.errorMessage ?? null,
    durationMs: input.durationMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    thinkingTokens: usage.thinkingTokens,
    totalTokens: usage.totalTokens,
    searchQueryCount: usage.searchQueries.length,
    searchQueries: JSON.stringify(usage.searchQueries),
    costInputUsd: costs.inputUsd,
    costOutputUsd: costs.outputUsd,
    costThinkingUsd: costs.thinkingUsd,
    costSearchUsd: costs.searchUsd,
    costTotalUsd: costs.totalUsd,
    pricingSnapshotId,
    billingTier,
    promptPreview: input.promptPreview.slice(0, 500),
    metadata: JSON.stringify(metadata),
  });

  return {
    id,
    createdAt,
    operation: input.trace.operation,
    category: input.trace.category,
    correlationId: input.trace.correlationId ?? null,
    region: input.trace.region ?? null,
    researchStage: input.trace.researchStage ?? null,
    model: GEMINI_MODEL,
    usedGoogleSearch: input.usedGoogleSearch,
    success: input.success,
    errorMessage: input.errorMessage ?? null,
    durationMs: input.durationMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    thinkingTokens: usage.thinkingTokens,
    totalTokens: usage.totalTokens,
    searchQueryCount: usage.searchQueries.length,
    searchQueries: usage.searchQueries,
    costInputUsd: costs.inputUsd,
    costOutputUsd: costs.outputUsd,
    costThinkingUsd: costs.thinkingUsd,
    costSearchUsd: costs.searchUsd,
    costTotalUsd: costs.totalUsd,
    pricingSnapshotId,
    billingTier,
    promptPreview: input.promptPreview.slice(0, 500),
    metadata,
  };
}

export async function listCostEvents(limit = 100): Promise<ApiCostEventRecord[]> {
  const userId = await getCurrentUserId();
  const db = getDb();
  const rows = await db
    .select()
    .from(apiCostEvents)
    .where(eq(apiCostEvents.userId, userId))
    .orderBy(desc(apiCostEvents.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    operation: row.operation,
    category: row.category as ApiCostEventRecord["category"],
    correlationId: row.correlationId,
    region: row.region,
    researchStage: row.researchStage,
    model: row.model,
    usedGoogleSearch: Boolean(row.usedGoogleSearch),
    success: Boolean(row.success),
    errorMessage: row.errorMessage,
    durationMs: row.durationMs,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    thinkingTokens: row.thinkingTokens,
    totalTokens: row.totalTokens,
    searchQueryCount: row.searchQueryCount,
    searchQueries: JSON.parse(row.searchQueries) as string[],
    costInputUsd: row.costInputUsd,
    costOutputUsd: row.costOutputUsd,
    costThinkingUsd: row.costThinkingUsd,
    costSearchUsd: row.costSearchUsd,
    costTotalUsd: row.costTotalUsd,
    pricingSnapshotId: row.pricingSnapshotId,
    billingTier: row.billingTier,
    promptPreview: row.promptPreview,
    metadata: JSON.parse(row.metadata) as Record<string, string>,
  }));
}

export async function getCostSummary() {
  const userId = await getCurrentUserId();
  const db = getDb();
  const totals = await db
    .select({
      totalUsd: sql<number>`coalesce(sum(${apiCostEvents.costTotalUsd}), 0)`,
      inputUsd: sql<number>`coalesce(sum(${apiCostEvents.costInputUsd}), 0)`,
      outputUsd: sql<number>`coalesce(sum(${apiCostEvents.costOutputUsd}), 0)`,
      searchUsd: sql<number>`coalesce(sum(${apiCostEvents.costSearchUsd}), 0)`,
      callCount: sql<number>`count(*)`,
      successCount: sql<number>`sum(case when ${apiCostEvents.success} then 1 else 0 end)`,
      totalTokens: sql<number>`coalesce(sum(${apiCostEvents.totalTokens}), 0)`,
      searchQueries: sql<number>`coalesce(sum(${apiCostEvents.searchQueryCount}), 0)`,
    })
    .from(apiCostEvents)
    .where(eq(apiCostEvents.userId, userId));

  const byCategory = await db
    .select({
      category: apiCostEvents.category,
      totalUsd: sql<number>`coalesce(sum(${apiCostEvents.costTotalUsd}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(apiCostEvents)
    .where(eq(apiCostEvents.userId, userId))
    .groupBy(apiCostEvents.category);

  const pricing = await fetchLivePricing(GEMINI_MODEL);
  const monthlySearchUsed = await getMonthlySearchUsage();

  return {
    totals: totals[0] ?? {
      totalUsd: 0,
      inputUsd: 0,
      outputUsd: 0,
      searchUsd: 0,
      callCount: 0,
      successCount: 0,
      totalTokens: 0,
      searchQueries: 0,
    },
    byCategory,
    pricing,
    billingTier: getBillingTier(),
    monthlySearchQueriesUsed: monthlySearchUsed,
    monthlySearchFreeQuota: pricing.freeSearchQueriesPerMonth,
  };
}

export async function getPricingSnapshot(
  id: string,
): Promise<ModelPricingRates | null> {
  const userId = await getCurrentUserId();
  const db = getDb();
  const rows = await db
    .select()
    .from(pricingSnapshots)
    .where(and(eq(pricingSnapshots.userId, userId), eq(pricingSnapshots.id, id)))
    .limit(1);
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].data) as ModelPricingRates;
}
