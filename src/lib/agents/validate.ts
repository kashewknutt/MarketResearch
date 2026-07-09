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

const financialMetricDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["revenue", "expense"]),
  group: z.string().optional(),
  recurring: z.boolean().optional(),
  order: z.number(),
  notes: z.string().optional(),
});

export const financialMetricWorkbookAiSchema = z.object({
  metrics: z.array(financialMetricDefSchema).min(3),
  conservative: z.record(z.string(), z.array(z.number())),
  ambitious: z.record(z.string(), z.array(z.number())),
  monthlyChurnRate: z.number().min(0).max(0.5).optional(),
  narrative: z.string().optional(),
  leverageVariables: z.array(z.string()).optional(),
  expenseLineItems: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.enum(["people", "tools", "marketing", "operations", "other"]),
        monthlyAmount: z.number(),
        headcount: z.number().optional(),
        unitCost: z.number().optional(),
        notes: z.string().optional(),
      }),
    )
    .optional(),
});

const adFormatSchema = z.enum([
  "reel",
  "short",
  "meme",
  "static_post",
  "carousel",
  "long_video",
  "story",
  "ad_creative",
]);

export const trendingAdExampleSchema = z.object({
  id: z.string(),
  platform: z.string(),
  brandName: z.string(),
  isOwnBrand: z.boolean(),
  format: adFormatSchema,
  title: z.string(),
  description: z.string(),
  whyTrending: z.string(),
  hook: z.string().optional(),
  engagementSignal: z.string().optional(),
  url: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  publishedAt: z.string().optional(),
  citations: z.array(citationSchema),
});

export const adIdeaSourceRefSchema = z.object({
  exampleId: z.string().optional(),
  title: z.string(),
  url: z.string().optional(),
  platform: z.string().optional(),
  brandName: z.string().optional(),
  engagementSignal: z.string().optional(),
  whyPicked: z.string(),
});

export const adIdeaSchema = z.object({
  id: z.string(),
  platform: z.string(),
  format: adFormatSchema,
  title: z.string(),
  hook: z.string(),
  concept: z.string(),
  scriptOrCaption: z.string(),
  whyThisWorks: z.string(),
  inspiredBy: z.string().optional(),
  sourceRef: adIdeaSourceRefSchema.optional(),
  priority: z.enum(["high", "medium", "low"]),
});

export const competitorAdActivitySchema = z.object({
  competitorName: z.string(),
  isDiscovered: z.boolean(),
  examples: z.array(trendingAdExampleSchema),
});

const adContentSceneSchema = z.object({
  order: z.number(),
  shot: z.string(),
  dialogueOrText: z.string(),
  durationSec: z.number().optional(),
  notes: z.string().optional(),
});

export const generatedAdContentPayloadSchema = z.object({
  script: z.string(),
  scenes: z.array(adContentSceneSchema),
  captionOrPost: z.string(),
  hashtags: z.array(z.string()).optional(),
  assetNotes: z.string().optional(),
});

export function safeParse<T>(schema: z.ZodType<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
