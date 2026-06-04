import { NextResponse } from "next/server";
import { getDemandsByRegion } from "@/lib/store/demands";
import { getAllLeads } from "@/lib/store/leads";
import { getAllActiveProjects } from "@/lib/store/projects";
import { getProfile } from "@/lib/store/settings";
import { getSnapshot } from "@/lib/store/snapshots";
import { buildProjections, defaultAssumptions } from "@/lib/research/projection-engine";
import type {
  CompetitorSnapshot,
  DashboardMetrics,
  FinancialSnapshot,
} from "@/lib/types/domain";

export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not onboarded" }, { status: 404 });
  }

  const demandsByRegion: Record<string, Awaited<ReturnType<typeof getDemandsByRegion>>> = {};
  for (const region of profile.regions) {
    demandsByRegion[region] = await getDemandsByRegion(region);
  }

  const projects = await getAllActiveProjects();
  const domainSummary = await getSnapshot<{ summary: string }>("domain_summary");
  const financial = await getSnapshot<FinancialSnapshot>("financial");
  const competitors = await getSnapshot<CompetitorSnapshot>("competitors");
  const leads = await getAllLeads();

  const built = financial
    ? buildProjections(
        profile,
        financial.assumptions.value,
        financial.narrative,
        financial.leverageVariables,
        financial.metricWorkbook,
        financial.monthlyPlans,
      )
    : buildProjections(profile, defaultAssumptions(profile));

  const projections = built.projections;
  const scenarioLabel =
    built.metricWorkbook?.activeScenario ??
    built.monthlyPlans?.activeScenario ??
    "ambitious";

  const metrics: DashboardMetrics = {
    currentMrr: profile.currentMrr,
    targetMrr: profile.targetMrr,
    gapToGoal: built.gapToGoal,
    mrrScenarioLabel: scenarioLabel,
    currency: profile.currency,
    leadCount: leads.length,
    activeProjects: projects.length,
    mrrSeries: projections.map((p) => ({ month: p.month, mrr: p.revenue })),
    regionalDemandCounts: Object.fromEntries(
      Object.entries(demandsByRegion).map(([r, d]) => [r, d.length]),
    ),
  };

  return NextResponse.json({
    profile,
    demandsByRegion,
    projects,
    domainSummary,
    metrics,
    competitors,
    leads: leads.slice(0, 8),
  });
}
