import { formatMoney } from "@/lib/currency";
import type {
  FinancialAssumptions,
  FinancialSnapshot,
  OnboardingProfile,
} from "@/lib/types/domain";
import { createProvenance } from "@/lib/db/provenance";
import { sanitizeAssumptions } from "@/lib/research/assumption-bounds";
import { migrateAssumptionsToLineItems } from "@/lib/research/expense-line-items";
import { simulateServiceBusinessMonths } from "@/lib/research/service-projection-engine";

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
): FinancialSnapshot {
  const months = Math.max(1, Math.min(50, profile.goalMonths));
  const defaults = defaultAssumptions(profile);
  const assumptions = sanitizeAssumptions(profile, rawAssumptions, defaults);

  const { projections, finalRecurringMrr } = simulateServiceBusinessMonths(
    profile,
    assumptions,
    months,
    profile.businessName,
  );

  const gapToGoal = Math.round(profile.targetMrr - finalRecurringMrr);
  const monthlyPaceRequired =
    months > 0
      ? Math.round((profile.targetMrr - profile.currentMrr) / months)
      : 0;

  const base = projections.map((p) => p.recurringMrr ?? p.revenue);
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
            "Land more mid-ticket and retainer deals",
            "Reduce months with zero new cash",
          ],
    narrative:
      narrative ||
      `Service-business model from ${formatMoney(profile.currentMrr, profile.currency)} starting MRR toward ${formatMoney(profile.targetMrr, profile.currency)} over ${months} months. Revenue is lumpy: mix of low-frequency small deals, mid-ticket projects, rare whales, and retainers—some months may show zero new cash while recurring MRR steps up gradually.`,
    provenance: createProvenance("ai"),
  };
}
