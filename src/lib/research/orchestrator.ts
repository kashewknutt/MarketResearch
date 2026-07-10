import { randomUUID } from "crypto";
import { generateStructuredJson, requireGeminiReady } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { isGeminiApiError } from "@/lib/ai/gemini-errors";
import {
  demandDiscoveryPrompt,
  domainUnderstandingPrompt,
  investmentPrompt,
  strategyPrompt,
} from "@/lib/ai/prompts";
import { createProvenance } from "@/lib/db/provenance";
import { ensureFullProjectQueues } from "@/lib/research/project-generator";
import { runAdTrends } from "@/lib/research/stages/ad-trends";
import { mergeAdTrendsSnapshot } from "@/lib/research/stages/ad-trends-merge";
import { runCompetitorIntelligence } from "@/lib/research/stages/competitor-intelligence";
import { runLeadDiscovery } from "@/lib/research/stages/lead-discovery";
import { runEnrichedMarketing } from "@/lib/research/stages/marketing-enriched";
import { enrichProjectsForRegion } from "@/lib/research/stages/project-enrichment";
import { runFinancialModeling } from "@/lib/research/stages/financial-modeling";
import { runSocialStrategy } from "@/lib/research/stages/social-strategy";
import { clearDemands, saveDemands } from "@/lib/store/demands";
import {
  createInitialStages,
  getResearchJob,
  saveResearchJob,
} from "@/lib/store/research-jobs";
import { getProfile } from "@/lib/store/settings";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type {
  AdTrendsSnapshot,
  CompetitorSnapshot,
  DemandSignal,
  FinancialAssumptions,
  FinancialSnapshot,
  InvestmentSnapshot,
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

    await runStage("project_enrichment", async () => {
      for (const region of profile.regions) {
        await enrichProjectsForRegion(profile, region, jobId);
      }
    });

    await runStage("competitor_intelligence", async () => {
      const competitors = await runCompetitorIntelligence(profile, jobId);
      await saveSnapshot("competitors", competitors);
    });

    await runStage("lead_discovery", async () => {
      await runLeadDiscovery(profile, jobId);
    });

    let financial!: FinancialSnapshot;
    await runStage("financial_modeling", async () => {
      financial = await runFinancialModeling(profile, jobId);
      await saveSnapshot("financial", financial);
    });

    await runStage("marketing_planning", async () => {
      const marketing = await runEnrichedMarketing(profile, jobId);
      await saveSnapshot("marketing", marketing);
    });

    await runStage("social_strategy", async () => {
      const social = await runSocialStrategy(profile, jobId);
      await saveSnapshot("marketing_social", social);
    });

    await runStage("ad_trends", async () => {
      const [competitors, existingAds] = await Promise.all([
        getSnapshot<CompetitorSnapshot>("competitors"),
        getSnapshot<AdTrendsSnapshot>("ads"),
      ]);
      const ads = await runAdTrends(
        profile,
        competitors,
        jobId,
        existingAds?.trackedCompetitors,
        existingAds?.competitorSocialHandles,
      );
      await saveSnapshot("ads", mergeAdTrendsSnapshot(existingAds, ads));
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
