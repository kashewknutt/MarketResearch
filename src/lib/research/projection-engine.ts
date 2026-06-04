import { formatMoney } from "@/lib/currency";
import type {
  FinancialAssumptions,
  FinancialMonthlyPlans,
  FinancialSnapshot,
  OnboardingProfile,
} from "@/lib/types/domain";
import { createProvenance } from "@/lib/db/provenance";
import { sanitizeAssumptions } from "@/lib/research/assumption-bounds";
import {
  buildDefaultMonthlyPlans,
  computeBothScenarios,
  normalizeMonthlyPlans,
} from "@/lib/research/financial-timeline-engine";
import { migrateAssumptionsToLineItems } from "@/lib/research/expense-line-items";

export function defaultAssumptions(profile: OnboardingProfile): FinancialAssumptions {
  const months = Math.max(1, profile.goalMonths);
  const mrrDelta = profile.targetMrr - profile.currentMrr;
  const monthlyGrowth = mrrDelta / months;
  const isInr = profile.currency === "INR";
  const avgMid = isInr ? 150000 : 5000;

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
    dealMixLowFrequency: 0.45,
    dealMixMidTicket: 0.35,
    dealMixHighTicket: 0.15,
    dealMixWhale: 0.05,
    ticketLow: Math.round(avgMid * 0.35),
    ticketMid: avgMid,
    ticketHigh: Math.round(avgMid * 2.5),
    ticketWhale: Math.round(avgMid * 10),
    monthsWithZeroCashPct: 0.18,
    retainerConversionRate: 0.25,
    retainerMrrFraction: 0.35,
  };

  return migrateAssumptionsToLineItems(base, profile, base);
}

export function buildProjections(
  profile: OnboardingProfile,
  rawAssumptions: FinancialAssumptions,
  narrative = "",
  leverageVariables: string[] = [],
  monthlyPlansInput?: FinancialMonthlyPlans,
): FinancialSnapshot {
  const months = Math.max(1, Math.min(50, profile.goalMonths));
  const defaults = defaultAssumptions(profile);
  const assumptions = sanitizeAssumptions(profile, rawAssumptions, defaults);

  const monthlyPlans = monthlyPlansInput
    ? normalizeMonthlyPlans(profile, assumptions, monthlyPlansInput)
    : buildDefaultMonthlyPlans(profile, assumptions);

  const { conservative, ambitious, active } = computeBothScenarios(
    profile,
    assumptions,
    monthlyPlans,
  );

  const gapToGoal = Math.round(profile.targetMrr - active.finalMrr);
  const monthlyPaceRequired =
    months > 0
      ? Math.round((profile.targetMrr - profile.currentMrr) / months)
      : 0;

  const scenarios = {
    conservative: conservative.mrrSeries,
    base: active.mrrSeries,
    aggressive: ambitious.mrrSeries,
  };

  const projections = active.projections;
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
    monthlyPlans,
    projections,
    scenarios,
    gapToGoal,
    monthlyPaceRequired,
    investmentByCategory,
    leverageVariables:
      leverageVariables.length > 0
        ? leverageVariables
        : [
            "Grow recurring low-ticket clients each month",
            "Schedule ~3 high-ticket deals per year in specific months",
            "Plan rare whale deals in ambitious scenario",
            "Tune monthly expense table to match hiring and ads",
          ],
    narrative:
      narrative ||
      `Table-driven plan from ${formatMoney(profile.currentMrr, profile.currency)} toward ${formatMoney(profile.targetMrr, profile.currency)} over ${months} months. Edit monthly income (Conservative vs Ambitious) and expenses; MRR grows from recurring low-ticket adds plus lumpy high-ticket and whale cash.`,
    provenance: createProvenance("ai"),
  };
}
