import { z } from "zod";

export const citationSchema = z.object({
  title: z.string(),
  uri: z.string().optional(),
});

export const precedentSchema = z.object({
  company: z.string(),
  action: z.string(),
  reportedResult: z.string(),
  metric: z.string().optional(),
  sourceTitle: z.string().optional(),
  sourceUri: z.string().optional(),
});

export const regionalPricingSchema = z.object({
  region: z.string(),
  min: z.number(),
  median: z.number(),
  max: z.number(),
  currency: z.string(),
  willingnessNote: z.string(),
  citations: z.array(citationSchema).min(1),
});

export const enrichedProjectSchema = z.object({
  rationale: z.string(),
  challenges: z.array(z.string()).min(1),
  solutions: z.array(z.string()).min(1),
  regionalPricing: z.array(regionalPricingSchema).min(1),
  precedents: z.array(precedentSchema),
  confidenceScore: z.number().min(0).max(1),
});

export const marketingItemEnrichedSchema = z.object({
  why: z.string().optional(),
  whyForBusiness: z.string().optional(),
  regions: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  runDuration: z.string().optional(),
  operatorType: z.string().optional(),
  executionNotes: z.string().optional(),
  expectedMetrics: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        unit: z.string().optional(),
      }),
    )
    .optional(),
  precedents: z.array(precedentSchema).optional(),
  successCases: z.array(precedentSchema).optional(),
  failureCases: z.array(precedentSchema).optional(),
  estimatedCost: z.number().optional(),
  estimatedCostCurrency: z.string().optional(),
  estimatedRunCost: z.number().optional(),
});

export const leadSchema = z
  .object({
    company: z.string(),
    region: z.string(),
    fitScore: z.number().min(0).max(100),
    signals: z.array(z.string()),
    contactHints: z.string(),
    whyFit: z.string().optional(),
    whyPerfect: z.string().optional(),
    pitchOutline: z.string().optional(),
    contactPlan: z.string().optional(),
    objections: z.array(z.string()).optional(),
    sources: z.array(citationSchema).min(1),
  })
  .transform((d) => ({
    ...d,
    whyFit: d.whyFit ?? d.whyPerfect ?? "",
  }));

export const competitorSchema = z.object({
  name: z.string(),
  region: z.string().optional(),
  estimatedMarketingSpendMin: z.number(),
  estimatedMarketingSpendMax: z.number(),
  spendCurrency: z.string(),
  positioning: z.string(),
  recommendedSpendNote: z.string(),
  sources: z.array(citationSchema).min(1),
});

export const socialPlatformSchema = z.object({
  platform: z.string(),
  audience: z.string(),
  tone: z.string(),
  contentPillars: z.array(z.string()),
  postingCadence: z.string(),
  differentiation: z.string(),
  kpis: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      unit: z.string().optional(),
    }),
  ),
  tactics: z.array(z.string()),
  citations: z.array(citationSchema),
});

export function safeParse<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
