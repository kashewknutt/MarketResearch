import { randomUUID } from "crypto";
import { generateStructuredJson, requireGeminiReady } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { isGeminiApiError } from "@/lib/ai/gemini-errors";
import {
  demandDiscoveryPrompt,
  domainUnderstandingPrompt,
  financialVariablesPrompt,
  investmentPrompt,
  marketingPrompt,
  strategyPrompt,
} from "@/lib/ai/prompts";
import { createProvenance } from "@/lib/db/provenance";
import {
  buildProjections,
  defaultAssumptions,
} from "@/lib/research/projection-engine";
import { ensureFullProjectQueues } from "@/lib/research/project-generator";
import { clearDemands, saveDemands } from "@/lib/store/demands";
import {
  createInitialStages,
  getResearchJob,
  saveResearchJob,
} from "@/lib/store/research-jobs";
import { getProfile } from "@/lib/store/settings";
import { saveSnapshot } from "@/lib/store/snapshots";
import type {
  DemandSignal,
  FinancialAssumptions,
  FinancialSnapshot,
  InvestmentSnapshot,
  MarketingItem,
  MarketingSnapshot,
  OnboardingProfile,
  RegionCode,
  ResearchJob,
  ResearchStageId,
  StrategySnapshot,
} from "@/lib/types/domain";

const CONCURRENCY = 3;

async function updateStage(
  jobId: string,
  stageId: ResearchStageId,
  patch: Partial<ResearchJob["stages"][0]>,
): Promise<void> {
  const job = await getResearchJob(jobId);
  if (!job) return;
  job.stages = job.stages.map((s) =>
    s.id === stageId ? { ...s, ...patch } : s,
  );
  await saveResearchJob(job);
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

function researchTrace(
  jobId: string,
  operation: string,
  stage: ResearchStageId,
  region?: RegionCode,
): AiCallTrace {
  return {
    operation,
    category: "research",
    correlationId: jobId,
    region,
    researchStage: stage,
  };
}

async function discoverDemands(
  profile: OnboardingProfile,
  region: RegionCode,
  jobId: string,
): Promise<DemandSignal[]> {
  const result = await generateStructuredJson<{
    demands: Array<{
      title: string;
      description: string;
      ticketSizeMin: number;
      ticketSizeMax: number;
      currency: string;
    }>;
  }>({
    task: `demands_${region}`,
    systemInstruction: `Market research for service businesses. Year: ${new Date().getFullYear()}.`,
    userPrompt: demandDiscoveryPrompt(profile, region),
    useGoogleSearch: true,
    parse: (raw) => raw as { demands: Array<{
      title: string;
      description: string;
      ticketSizeMin: number;
      ticketSizeMax: number;
      currency: string;
    }> },
    trace: researchTrace(jobId, `research.demands_${region}`, "demand_discovery", region),
  });

  return result.data.demands.slice(0, 10).map((d, i) => ({
    id: randomUUID(),
    region,
    rank: i + 1,
    title: d.title,
    description: d.description,
    ticketSizeMin: d.ticketSizeMin,
    ticketSizeMax: d.ticketSizeMax,
    currency: d.currency,
    provenance: createProvenance("search", result.citations, 0.85),
  }));
}

async function runFinancial(
  profile: OnboardingProfile,
  jobId: string,
): Promise<FinancialSnapshot> {
  const result = await generateStructuredJson<
    FinancialAssumptions & {
      narrative: string;
      leverageVariables: string[];
    }
  >({
    task: "financial_variables",
    systemInstruction: "Financial analyst for service businesses. JSON only.",
    userPrompt: financialVariablesPrompt(profile),
    useGoogleSearch: false,
    parse: (raw) =>
      raw as FinancialAssumptions & {
        narrative: string;
        leverageVariables: string[];
        },
    trace: researchTrace(jobId, "research.financial_model", "financial_modeling"),
  });

  const defaults = defaultAssumptions(profile);
  const { narrative, leverageVariables, ...rawAssumptions } = result.data;
  const assumptions: FinancialAssumptions = {
    ...defaults,
    ...rawAssumptions,
  };
  const snapshot = buildProjections(
    profile,
    assumptions,
    narrative,
    leverageVariables,
  );
  snapshot.provenance = createProvenance("ai", result.citations, 0.8);
  snapshot.assumptions = {
    ...snapshot.assumptions,
    ...createProvenance("ai", result.citations, 0.8),
  };
  return snapshot;
}

async function runMarketing(
  profile: OnboardingProfile,
  jobId: string,
): Promise<MarketingSnapshot> {
  type RawMarketingItem = {
    title: string;
    description: string;
    priority: string;
    region: string | null;
  };
  const result = await generateStructuredJson<{
    positioning: string;
    contentThemes: RawMarketingItem[];
    offers: RawMarketingItem[];
    channels: RawMarketingItem[];
    proofAssets: RawMarketingItem[];
  }>({
    task: "marketing",
    systemInstruction: "Marketing strategist for B2B service companies.",
    userPrompt: marketingPrompt(profile),
    useGoogleSearch: true,
    parse: (raw) => {
      const obj = raw as {
        positioning: string;
        contentThemes: RawMarketingItem[];
        offers: RawMarketingItem[];
        channels: RawMarketingItem[];
        proofAssets: RawMarketingItem[];
      };
      return obj;
    },
    trace: researchTrace(jobId, "research.marketing", "marketing_planning"),
  });

  const toItems = (
    category: string,
    items: Array<{
      title: string;
      description: string;
      priority: string;
      region: string | null;
    }>,
  ): MarketingItem[] =>
    items.map((item) => ({
      id: randomUUID(),
      category,
      title: item.title,
      description: item.description,
      priority: item.priority as MarketingItem["priority"],
      region: item.region ?? undefined,
      provenance: createProvenance("search", result.citations, 0.8),
    }));

  return {
    positioning: result.data.positioning,
    contentThemes: toItems("content", result.data.contentThemes ?? []),
    offers: toItems("offer", result.data.offers ?? []),
    channels: toItems("channel", result.data.channels ?? []),
    proofAssets: toItems("proof", result.data.proofAssets ?? []),
    provenance: createProvenance("search", result.citations, 0.8),
  };
}

async function runStrategy(
  profile: OnboardingProfile,
  jobId: string,
): Promise<StrategySnapshot> {
  const result = await generateStructuredJson<StrategySnapshot>({
    task: "strategy",
    systemInstruction: "Business strategist for service companies.",
    userPrompt: strategyPrompt(profile),
    useGoogleSearch: true,
    parse: (raw) => raw as StrategySnapshot,
    trace: researchTrace(jobId, "research.strategy", "investment_allocation"),
  });
  return {
    ...result.data,
    provenance: createProvenance("search", result.citations, 0.8),
  };
}

async function runInvestment(
  profile: OnboardingProfile,
  financial: FinancialSnapshot,
  jobId: string,
): Promise<InvestmentSnapshot> {
  const result = await generateStructuredJson<{
    totalRecommended: number;
    allocations: Array<{
      category: string;
      amount: number;
      percentage: number;
      rationale: string;
      expectedOutcome: string;
    }>;
  }>({
    task: "investment",
    systemInstruction: "Investment advisor for small service businesses.",
    userPrompt: investmentPrompt(profile, financial.gapToGoal),
    useGoogleSearch: false,
    parse: (raw) => raw as {
      totalRecommended: number;
      allocations: Array<{
        category: string;
        amount: number;
        percentage: number;
        rationale: string;
        expectedOutcome: string;
      }>;
    },
    trace: researchTrace(jobId, "research.investment", "investment_allocation"),
  });

  return {
    totalRecommended: result.data.totalRecommended,
    allocations: result.data.allocations.map((a) => ({
      ...a,
      provenance: createProvenance("ai", result.citations, 0.75),
    })),
    provenance: createProvenance("ai", result.citations, 0.75),
  };
}

function geminiErrorMessage(err: unknown): string {
  if (isGeminiApiError(err)) return err.userMessage;
  return err instanceof Error ? err.message : "Research failed";
}

export async function startResearchPipeline(jobId: string): Promise<void> {
  const profile = await getProfile();
  if (!profile) throw new Error("Profile not found");

  const runStage = async (
    stageId: ResearchStageId,
    fn: () => Promise<void>,
  ) => {
    await updateStage(jobId, stageId, {
      status: "running",
      progress: 10,
      message: "In progress…",
    });
    try {
      await fn();
      await updateStage(jobId, stageId, {
        status: "completed",
        progress: 100,
        message: "Done",
      });
    } catch (err) {
      await updateStage(jobId, stageId, {
        status: "failed",
        progress: 0,
        error: geminiErrorMessage(err),
      });
      throw err;
    }
  };

  try {
    await requireGeminiReady();

    await runStage("domain_understanding", async () => {
      const result = await generateStructuredJson<{
        summary: string;
        positioning: string;
        keyInsights: string[];
      }>({
        task: "domain",
        systemInstruction: `Business analyst. Year ${new Date().getFullYear()}.`,
        userPrompt: domainUnderstandingPrompt(profile),
        useGoogleSearch: true,
        parse: (raw) =>
          raw as {
            summary: string;
            positioning: string;
            keyInsights: string[];
          },
        trace: researchTrace(jobId, "research.domain", "domain_understanding"),
      });
      await saveSnapshot("domain_summary", {
        summary: result.data.summary,
        positioning: result.data.positioning,
        keyInsights: result.data.keyInsights,
        updatedAt: new Date().toISOString(),
      });
    });

    await runStage("demand_discovery", async () => {
      await clearDemands();
      const tasks = profile.regions.map(
        (region) => () => discoverDemands(profile, region, jobId),
      );
      const allDemands = await runWithConcurrency(tasks, CONCURRENCY);
      await saveDemands(allDemands.flat());
    });

    await runStage("regional_projects", async () => {
      await ensureFullProjectQueues(profile, jobId);
    });

    let financial!: FinancialSnapshot;
    await runStage("financial_modeling", async () => {
      financial = await runFinancial(profile, jobId);
      await saveSnapshot("financial", financial);
    });

    await runStage("marketing_planning", async () => {
      const marketing = await runMarketing(profile, jobId);
      await saveSnapshot("marketing", marketing);
    });

    await runStage("investment_allocation", async () => {
      const [strategy, investment] = await Promise.all([
        runStrategy(profile, jobId),
        runInvestment(profile, financial, jobId),
      ]);
      await saveSnapshot("strategy", strategy);
      await saveSnapshot("investment", investment);
    });

    const job = await getResearchJob(jobId);
    if (job) {
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      await saveResearchJob(job);
    }
  } catch {
    const job = await getResearchJob(jobId);
    if (job) {
      job.status = "failed";
      await saveResearchJob(job);
    }
  }
}

export async function createAndStartResearchJob(): Promise<ResearchJob> {
  await requireGeminiReady();

  const job: ResearchJob = {
    id: randomUUID(),
    status: "running",
    stages: createInitialStages(),
    startedAt: new Date().toISOString(),
  };
  await saveResearchJob(job);
  void startResearchPipeline(job.id);
  return job;
}
