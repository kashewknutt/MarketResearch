export interface ModelPricingRates {
  modelId: string;
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
  searchPerThousandQueriesUsd: number;
  freeSearchQueriesPerMonth: number;
  sourceUrl: string;
  sourceLabel: string;
  fetchedAt: string;
  parseMethod: "live_html" | "cache" | "fallback";
}

export type CostEventCategory =
  | "setup"
  | "research"
  | "projects"
  | "status"
  | "system";

export interface AiCallTrace {
  operation: string;
  category: CostEventCategory;
  correlationId?: string;
  region?: string;
  researchStage?: string;
  metadata?: Record<string, string>;
}

export interface CostBreakdown {
  inputUsd: number;
  outputUsd: number;
  thinkingUsd: number;
  searchUsd: number;
  totalUsd: number;
}

export interface ApiCostEventRecord {
  id: string;
  createdAt: string;
  operation: string;
  category: CostEventCategory;
  correlationId: string | null;
  region: string | null;
  researchStage: string | null;
  model: string;
  usedGoogleSearch: boolean;
  success: boolean;
  errorMessage: string | null;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  searchQueryCount: number;
  searchQueries: string[];
  costInputUsd: number;
  costOutputUsd: number;
  costThinkingUsd: number;
  costSearchUsd: number;
  costTotalUsd: number;
  pricingSnapshotId: string;
  billingTier: string;
  promptPreview: string;
  metadata: Record<string, string>;
}
