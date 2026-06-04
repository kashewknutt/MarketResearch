import type {
  FinancialAssumptions,
  FinancialSnapshot,
  MonthlyProjection,
  OnboardingProfile,
} from "@/lib/types/domain";
import { createProvenance } from "@/lib/db/provenance";

export function defaultAssumptions(profile: OnboardingProfile): FinancialAssumptions {
  const monthlyGrowth =
    profile.goalMonths > 0
      ? (profile.goalRevenue - profile.currentMrr) / profile.goalMonths
      : 0;
  return {
    averageTicketUs: 5000,
    averageTicketIndia: 150000,
    closeRate: 0.15,
    leadVolume: Math.max(20, Math.round(monthlyGrowth / 500)),
    leadToCallRate: 0.35,
    callToCloseRate: 0.25,
    deliveryCapacity: 4,
    hiringCost: 8000,
    hiringMonth: Math.min(12, profile.goalMonths),
    grossMarginTarget: 0.55,
    marketingSpend: Math.max(1500, profile.currentMrr * 0.1),
    toolingSpend: 500,
    retentionRate: 0.85,
  };
}

export function buildProjections(
  profile: OnboardingProfile,
  assumptions: FinancialAssumptions,
  narrative = "",
  leverageVariables: string[] = [],
): FinancialSnapshot {
  const months = profile.goalMonths;
  const projections: MonthlyProjection[] = [];
  let cumulative = profile.currentMrr;
  let revenue = profile.currentMrr;

  const monthlyNewDeals =
    assumptions.leadVolume *
    assumptions.leadToCallRate *
    assumptions.callToCloseRate;
  const avgTicket =
    (assumptions.averageTicketUs + assumptions.averageTicketIndia / 85) / 2;

  for (let m = 1; m <= months; m++) {
    const hiringBoost =
      m >= assumptions.hiringMonth ? assumptions.deliveryCapacity * 0.08 : 0;
    const growthRate =
      0.04 + hiringBoost + assumptions.retentionRate * 0.02;
    revenue = revenue * (1 + growthRate) + monthlyNewDeals * avgTicket * 0.02;
    const investment =
      assumptions.marketingSpend +
      assumptions.toolingSpend +
      (m === assumptions.hiringMonth ? assumptions.hiringCost : 0);
    cumulative += revenue * 0.15;
    const pipelineNeeded =
      (profile.goalRevenue - revenue) /
      Math.max(0.01, assumptions.closeRate * avgTicket);

    projections.push({
      month: m,
      revenue: Math.round(revenue),
      cumulativeRevenue: Math.round(cumulative),
      investment: Math.round(investment),
      pipelineNeeded: Math.max(0, Math.round(pipelineNeeded)),
    });
  }

  const finalRevenue = projections[projections.length - 1]?.revenue ?? revenue;
  const gapToGoal = profile.goalRevenue - finalRevenue;
  const monthlyPaceRequired =
    profile.goalMonths > 0 ? gapToGoal / profile.goalMonths : gapToGoal;

  const base = projections.map((p) => p.revenue);
  const scenarios = {
    conservative: base.map((r) => Math.round(r * 0.85)),
    base,
    aggressive: base.map((r) => Math.round(r * 1.15)),
  };

  const totalInvestment = projections.reduce((s, p) => s + p.investment, 0);
  const investmentByCategory = {
    marketing: assumptions.marketingSpend * months,
    tooling: assumptions.toolingSpend * months,
    hiring: assumptions.hiringCost,
    delivery: Math.round(totalInvestment * 0.25),
    experimentation: Math.round(totalInvestment * 0.1),
  };

  return {
    assumptions: {
      value: assumptions,
      ...createProvenance("ai"),
    },
    projections,
    scenarios,
    gapToGoal: Math.round(gapToGoal),
    monthlyPaceRequired: Math.round(monthlyPaceRequired),
    investmentByCategory,
    leverageVariables:
      leverageVariables.length > 0
        ? leverageVariables
        : [
            "Increase lead volume",
            "Improve call-to-close rate",
            "Raise average ticket size",
            "Expand delivery capacity",
          ],
    narrative:
      narrative ||
      `To reach $${profile.goalRevenue.toLocaleString()} in ${months} months from $${profile.currentMrr.toLocaleString()} MRR, focus on pipeline growth and conversion efficiency.`,
    provenance: createProvenance("ai"),
  };
}
