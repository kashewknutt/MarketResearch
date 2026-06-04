import { randomUUID } from "crypto";
import { requireGeminiReady } from "@/lib/ai/gemini";
import { createAndStartResearchJob } from "@/lib/research/orchestrator";
import { runCompetitorIntelligence } from "@/lib/research/stages/competitor-intelligence";
import { runLeadDiscovery } from "@/lib/research/stages/lead-discovery";
import { runEnrichedMarketing } from "@/lib/research/stages/marketing-enriched";
import { enrichProjectsForRegion } from "@/lib/research/stages/project-enrichment";
import { runFinancialModeling } from "@/lib/research/stages/financial-modeling";
import { runSocialStrategy } from "@/lib/research/stages/social-strategy";
import { ensureFullProjectQueues } from "@/lib/research/project-generator";
import { getProfile } from "@/lib/store/settings";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { FinancialSnapshot } from "@/lib/types/domain";
import { generateStructuredJson } from "@/lib/ai/gemini";
import { createProvenance } from "@/lib/db/provenance";
import { investmentPrompt, strategyPrompt } from "@/lib/ai/prompts";
import type { InvestmentSnapshot, StrategySnapshot } from "@/lib/types/domain";
import type { RefreshSection } from "@/lib/research/refresh-section-config";

export type { RefreshSection } from "@/lib/research/refresh-section-config";

async function runStrategyRefresh(
  profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>,
  jobId: string,
): Promise<void> {
  const result = await generateStructuredJson<StrategySnapshot>({
    task: "strategy_refresh",
    systemInstruction: "Business strategist for service companies.",
    userPrompt: strategyPrompt(profile),
    useGoogleSearch: true,
    parse: (raw) => raw as StrategySnapshot,
    trace: {
      operation: "refresh.strategy",
      category: "research",
      correlationId: jobId,
      researchStage: "investment_allocation",
    },
  });
  await saveSnapshot("strategy", {
    ...result.data,
    provenance: createProvenance("search", result.citations, 0.8),
  });
}

async function runInvestmentRefresh(
  profile: NonNullable<Awaited<ReturnType<typeof getProfile>>>,
  jobId: string,
): Promise<void> {
  let financial = await getSnapshot<FinancialSnapshot>("financial");
  if (!financial) {
    financial = await runFinancialModeling(profile, jobId);
    await saveSnapshot("financial", financial);
  }

  const result = await generateStructuredJson<{
    totalRecommended: number;
    allocations: InvestmentSnapshot["allocations"];
  }>({
    task: "investment_refresh",
    systemInstruction: "Investment advisor for small service businesses.",
    userPrompt: investmentPrompt(profile, financial.gapToGoal),
    useGoogleSearch: false,
    parse: (raw) =>
      raw as {
        totalRecommended: number;
        allocations: InvestmentSnapshot["allocations"];
      },
    trace: {
      operation: "refresh.investment",
      category: "research",
      correlationId: jobId,
      researchStage: "investment_allocation",
    },
  });

  await saveSnapshot("investment", {
    totalRecommended: result.data.totalRecommended,
    allocations: result.data.allocations.map((a) => ({
      ...a,
      provenance: createProvenance("ai", result.citations, 0.75),
    })),
    provenance: createProvenance("ai", result.citations, 0.75),
  });
}

export type RefreshResult =
  | { mode: "job"; jobId: string }
  | { mode: "inline"; section: RefreshSection }
  | { mode: "client"; section: RefreshSection };

/** Run AI refresh for a section. `all` starts full pipeline and returns jobId. */
export async function runSectionRefresh(
  section: RefreshSection,
): Promise<RefreshResult> {
  if (section === "sources") {
    return { mode: "client", section };
  }

  if (section === "api-costs") {
    return { mode: "client", section };
  }

  await requireGeminiReady();
  const profile = await getProfile();
  if (!profile) {
    throw new Error("Complete onboarding before refreshing research.");
  }

  if (section === "all") {
    const job = await createAndStartResearchJob();
    return { mode: "job", jobId: job.id };
  }

  const jobId = randomUUID();

  switch (section) {
    case "financial": {
      const financial = await runFinancialModeling(profile, jobId);
      await saveSnapshot("financial", financial);
      break;
    }
    case "leads":
      await runLeadDiscovery(profile, jobId);
      break;
    case "marketing": {
      const marketing = await runEnrichedMarketing(profile, jobId);
      await saveSnapshot("marketing", marketing);
      const social = await runSocialStrategy(profile, jobId);
      await saveSnapshot("marketing_social", social);
      break;
    }
    case "projects":
      await ensureFullProjectQueues(profile, jobId);
      for (const region of profile.regions) {
        await enrichProjectsForRegion(profile, region, jobId);
      }
      break;
    case "strategy":
      await runStrategyRefresh(profile, jobId);
      break;
    case "investment":
      await runInvestmentRefresh(profile, jobId);
      break;
    case "competitors": {
      const competitors = await runCompetitorIntelligence(profile, jobId);
      await saveSnapshot("competitors", competitors);
      break;
    }
    default:
      break;
  }

  return { mode: "inline", section };
}
