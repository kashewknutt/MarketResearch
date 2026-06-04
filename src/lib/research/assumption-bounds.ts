import { normalizeCurrency } from "@/lib/currency";
import { migrateAssumptionsToLineItems } from "@/lib/research/expense-line-items";
import type { FinancialAssumptions, OnboardingProfile } from "@/lib/types/domain";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function ticketCap(currency: string): number {
  const code = normalizeCurrency(currency);
  if (code === "INR") return 5_000_000;
  if (code === "JPY") return 50_000_000;
  return 500_000;
}

export function sanitizeAssumptions(
  profile: OnboardingProfile,
  raw: Partial<FinancialAssumptions>,
  defaults: FinancialAssumptions,
): FinancialAssumptions {
  const cap = ticketCap(profile.currency);
  const months = Math.max(1, profile.goalMonths);

  const base = migrateAssumptionsToLineItems(raw, profile, defaults);

  const sanitizedItems = (base.expenseLineItems ?? []).map((item) => ({
    ...item,
    monthlyAmount: clamp(
      Number(item.monthlyAmount) || 0,
      0,
      Math.max(profile.targetMrr, profile.currentMrr) * 2,
    ),
    headcount: item.headcount != null ? clamp(Math.round(item.headcount), 0, 500) : undefined,
    unitCost:
      item.unitCost != null
        ? clamp(Number(item.unitCost), 0, cap * 12)
        : undefined,
    startMonth:
      item.startMonth != null
        ? clamp(Math.round(item.startMonth), 1, months)
        : undefined,
  }));

  const withItems = migrateAssumptionsToLineItems(
    { ...base, expenseLineItems: sanitizedItems },
    profile,
    defaults,
  );

  const spendCap = Math.max(profile.targetMrr, profile.currentMrr) * 2;

  return migrateAssumptionsToLineItems(
    {
      ...withItems,
      averageTicketUs: clamp(
        Number(raw.averageTicketUs ?? withItems.averageTicketUs) || withItems.averageTicketUs,
        100,
        cap,
      ),
      averageTicketIndia: clamp(
        Number(raw.averageTicketIndia ?? withItems.averageTicketIndia) ||
          withItems.averageTicketIndia,
        100,
        cap,
      ),
      closeRate: clamp(
        Number(raw.closeRate ?? withItems.closeRate) || withItems.closeRate,
        0.01,
        0.9,
      ),
      leadVolume: clamp(
        Math.round(Number(raw.leadVolume ?? withItems.leadVolume) || withItems.leadVolume),
        1,
        500,
      ),
      leadToCallRate: clamp(
        Number(raw.leadToCallRate ?? withItems.leadToCallRate) || withItems.leadToCallRate,
        0.01,
        1,
      ),
      callToCloseRate: clamp(
        Number(raw.callToCloseRate ?? withItems.callToCloseRate) || withItems.callToCloseRate,
        0.01,
        1,
      ),
      deliveryCapacity: clamp(
        Math.round(Number(raw.deliveryCapacity ?? withItems.deliveryCapacity) || 4),
        1,
        50,
      ),
      hiringCost: clamp(
        Number(raw.hiringCost ?? withItems.hiringCost) || withItems.hiringCost,
        0,
        cap * 12,
      ),
      hiringMonth: clamp(
        Math.round(Number(raw.hiringMonth ?? withItems.hiringMonth) || withItems.hiringMonth),
        1,
        months,
      ),
      grossMarginTarget: clamp(
        Number(raw.grossMarginTarget ?? withItems.grossMarginTarget) ||
          withItems.grossMarginTarget,
        0.1,
        0.95,
      ),
      marketingSpend: clamp(
        Number(raw.marketingSpend ?? withItems.marketingSpend) || withItems.marketingSpend,
        0,
        spendCap,
      ),
      toolingSpend: clamp(
        Number(raw.toolingSpend ?? withItems.toolingSpend) || withItems.toolingSpend,
        0,
        Math.max(profile.targetMrr, profile.currentMrr),
      ),
      retentionRate: clamp(
        Number(raw.retentionRate ?? withItems.retentionRate) || withItems.retentionRate,
        0.5,
        1,
      ),
      expenseLineItems: sanitizedItems,
    },
    profile,
    defaults,
  );
}
