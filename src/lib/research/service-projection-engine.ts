import type {
  FinancialAssumptions,
  MonthlyDealBreakdown,
  MonthlyProjection,
  OnboardingProfile,
} from "@/lib/types/domain";
import { expenseForMonth } from "@/lib/research/expense-line-items";

function createRng(seed: string, month: number): () => number {
  let h = month;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = Math.imul(h, 1664525) + 1013904223;
    return ((h >>> 0) % 10000) / 10000;
  };
}

function avgTicketForProfile(
  profile: OnboardingProfile,
  assumptions: FinancialAssumptions,
): number {
  if (profile.regions.includes("India") && profile.regions.includes("US")) {
    return (assumptions.averageTicketUs + assumptions.averageTicketIndia) / 2;
  }
  return profile.regions.includes("India")
    ? assumptions.averageTicketIndia
    : assumptions.averageTicketUs;
}

export type ServiceSimulationResult = {
  projections: MonthlyProjection[];
  finalRecurringMrr: number;
};

export function simulateServiceBusinessMonths(
  profile: OnboardingProfile,
  assumptions: FinancialAssumptions,
  months: number,
  seed = "financial",
): ServiceSimulationResult {
  const avg = avgTicketForProfile(profile, assumptions);
  const ticketLow = assumptions.ticketLow ?? Math.round(avg * 0.35);
  const ticketMid = assumptions.ticketMid ?? Math.round(avg);
  const ticketHigh = assumptions.ticketHigh ?? Math.round(avg * 2.5);
  const ticketWhale = assumptions.ticketWhale ?? Math.round(avg * 10);

  const mixLow = assumptions.dealMixLowFrequency ?? 0.45;
  const mixMid = assumptions.dealMixMidTicket ?? 0.35;
  const mixHigh = assumptions.dealMixHighTicket ?? 0.15;
  const mixWhale = assumptions.dealMixWhale ?? 0.05;
  const zeroCashPct = Math.min(0.45, Math.max(0, assumptions.monthsWithZeroCashPct ?? 0.18));
  const retainerConv = assumptions.retainerConversionRate ?? 0.25;
  const retainerFrac = assumptions.retainerMrrFraction ?? 0.35;

  const baseCloses =
    assumptions.leadVolume *
    assumptions.leadToCallRate *
    assumptions.callToCloseRate *
    assumptions.closeRate;

  let recurringMrr = profile.currentMrr;
  const projections: MonthlyProjection[] = [];
  let cumulativeMrr = 0;

  for (let m = 1; m <= months; m++) {
    const rng = createRng(seed, m);
    const jitter = 0.4 + rng() * 1.2;
    let closes = Math.max(0, Math.round(baseCloses * jitter));

    if (rng() < zeroCashPct) {
      closes = 0;
    }

    const whaleThisMonth = closes > 0 && m % 7 === 0 && rng() < mixWhale * 4 ? 1 : 0;
    let remaining = Math.max(0, closes - whaleThisMonth);
    const low = Math.min(remaining, Math.round(remaining * mixLow));
    remaining -= low;
    const mid = Math.min(remaining, Math.round(remaining * mixMid));
    remaining -= mid;
    const high = remaining;

    const cashCollected =
      low * ticketLow +
      mid * ticketMid +
      high * ticketHigh +
      whaleThisMonth * ticketWhale;

    const newRetainers = Math.round((high + whaleThisMonth) * retainerConv);
    const newRetainerMrr = Math.round(newRetainers * ticketMid * retainerFrac);

    recurringMrr = Math.round(
      recurringMrr * assumptions.retentionRate + newRetainerMrr,
    );

    const expenseBreakdown = expenseForMonth(assumptions.expenseLineItems ?? [], m);
    const expenses = Math.round(expenseBreakdown.total);
    const cash = Math.round(cashCollected);
    const netCash = cash - expenses;

    cumulativeMrr += recurringMrr;

    const deals: MonthlyDealBreakdown = {
      lowTicket: low,
      midTicket: mid,
      highTicket: high,
      whale: whaleThisMonth,
      newRetainers,
    };

    projections.push({
      month: m,
      revenue: recurringMrr,
      recurringMrr,
      cashCollected: cash,
      cumulativeRevenue: Math.round(cumulativeMrr),
      expenses,
      investment: expenses,
      pipelineNeeded: Math.max(
        0,
        Math.round(
          (profile.targetMrr - recurringMrr) /
            Math.max(1, assumptions.closeRate * avg),
        ),
      ),
      netCash,
      netMrr: netCash,
      newContracts: deals,
      expenseByCategory: expenseBreakdown.byCategory,
      expenseByLineItem: expenseBreakdown.byLine,
    });
  }

  return { projections, finalRecurringMrr: recurringMrr };
}
