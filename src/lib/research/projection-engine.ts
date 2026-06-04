import { formatMoney } from "@/lib/currency";
import type {
  FinancialAssumptions,
  FinancialSnapshot,
  MonthlyProjection,
  OnboardingProfile,
} from "@/lib/types/domain";
import { createProvenance } from "@/lib/db/provenance";
import { sanitizeAssumptions } from "@/lib/research/assumption-bounds";
import {
  expenseForMonth,
  migrateAssumptionsToLineItems,
} from "@/lib/research/expense-line-items";

export function defaultAssumptions(profile: OnboardingProfile): FinancialAssumptions {
  const months = Math.max(1, profile.goalMonths);
  const mrrDelta = profile.targetMrr - profile.currentMrr;
  const monthlyGrowth = mrrDelta / months;
  const isInr = profile.currency === "INR";

  const base = {
    averageTicketUs: isInr ? 5000 * 85 : 5000,
    averageTicketIndia: isInr ? 150000 : 150000 / 85,
    closeRate: 0.15,
    leadVolume: Math.max(5, Math.min(100, Math.round(Math.abs(monthlyGrowth) / 1000) || 20)),
    leadToCallRate: 0.35,
    callToCloseRate: 0.25,
    deliveryCapacity: 4,
    hiringCost: Math.max(5000, profile.currentMrr * 0.5),
    hiringMonth: Math.min(12, months),
    grossMarginTarget: 0.55,
    marketingSpend: Math.max(500, profile.currentMrr * 0.1),
    toolingSpend: 500,
    retentionRate: 0.9,
  };

  return migrateAssumptionsToLineItems(base, profile, base);
}

/** Linear MRR ramp from current → target over the horizon. */
function plannedMrr(profile: OnboardingProfile, month: number): number {
  const months = Math.max(1, profile.goalMonths);
  const t = month / months;
  return profile.currentMrr + (profile.targetMrr - profile.currentMrr) * t;
}

function monthlyExpenses(assumptions: FinancialAssumptions, month: number) {
  const items = assumptions.expenseLineItems ?? [];
  if (items.length > 0) {
    return expenseForMonth(items, month);
  }
  const legacy =
    assumptions.marketingSpend +
    assumptions.toolingSpend +
    (month === assumptions.hiringMonth ? assumptions.hiringCost : 0);
  return {
    total: legacy,
    byLine: {} as Record<string, number>,
    byCategory: {
      people: month === assumptions.hiringMonth ? assumptions.hiringCost : 0,
      tools: assumptions.toolingSpend,
      marketing: assumptions.marketingSpend,
      operations: 0,
      other: 0,
    },
  };
}

export function buildProjections(
  profile: OnboardingProfile,
  rawAssumptions: FinancialAssumptions,
  narrative = "",
  leverageVariables: string[] = [],
): FinancialSnapshot {
  const months = Math.max(1, Math.min(50, profile.goalMonths));
  const defaults = defaultAssumptions(profile);
  const assumptions = sanitizeAssumptions(profile, rawAssumptions, defaults);

  const projections: MonthlyProjection[] = [];
  let cumulativeMrr = 0;

  const avgTicket =
    profile.regions.includes("India") && profile.regions.includes("US")
      ? (assumptions.averageTicketUs + assumptions.averageTicketIndia) / 2
      : profile.regions.includes("India")
        ? assumptions.averageTicketIndia
        : assumptions.averageTicketUs;

  for (let m = 1; m <= months; m++) {
    const mrr = Math.round(plannedMrr({ ...profile, goalMonths: months }, m));
    cumulativeMrr += mrr;
    const expenseBreakdown = monthlyExpenses(assumptions, m);
    const expenses = Math.round(expenseBreakdown.total);
    const gapRemaining = profile.targetMrr - mrr;
    const pipelineNeeded =
      gapRemaining > 0
        ? gapRemaining / Math.max(1, assumptions.closeRate * avgTicket)
        : 0;

    projections.push({
      month: m,
      revenue: mrr,
      cumulativeRevenue: Math.round(cumulativeMrr),
      expenses,
      investment: expenses,
      pipelineNeeded: Math.max(0, Math.round(pipelineNeeded)),
      netMrr: mrr - expenses,
      expenseByCategory: expenseBreakdown.byCategory,
      expenseByLineItem: expenseBreakdown.byLine,
    });
  }

  const finalMrr = projections[projections.length - 1]?.revenue ?? profile.currentMrr;
  const gapToGoal = Math.round(profile.targetMrr - finalMrr);
  const monthlyPaceRequired =
    months > 0
      ? Math.round((profile.targetMrr - profile.currentMrr) / months)
      : 0;

  const base = projections.map((p) => p.revenue);
  const scenarios = {
    conservative: base.map((r) => Math.round(r * 0.85)),
    base,
    aggressive: base.map((r) => Math.round(Math.min(r * 1.15, profile.targetMrr * 1.05))),
  };

  const totalExpenses = projections.reduce((s, p) => s + p.expenses, 0);
  const items = assumptions.expenseLineItems ?? [];
  const categoryTotals = items.reduce(
    (acc, item) => {
      acc[item.category] = (acc[item.category] ?? 0) + item.monthlyAmount * months;
      return acc;
    },
    {} as Record<string, number>,
  );
  const investmentByCategory = {
    marketing: Math.round(categoryTotals.marketing ?? assumptions.marketingSpend * months),
    tooling: Math.round(categoryTotals.tools ?? assumptions.toolingSpend * months),
    hiring: Math.round(categoryTotals.people ?? 0),
    delivery: Math.round((categoryTotals.operations ?? 0) + totalExpenses * 0.1),
    experimentation: Math.round(totalExpenses * 0.05),
  };

  return {
    assumptions: {
      value: assumptions,
      ...createProvenance("ai"),
    },
    projections,
    scenarios,
    gapToGoal,
    monthlyPaceRequired,
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
      `Plan a linear path from ${formatMoney(profile.currentMrr, profile.currency)} to ${formatMoney(profile.targetMrr, profile.currency)} target MRR over ${months} months. Monthly operating spend is broken down by expense line items (people, tools, marketing, operations) and modeled separately from MRR.`,
    provenance: createProvenance("ai"),
  };
}
