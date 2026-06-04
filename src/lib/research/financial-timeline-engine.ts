import { expenseForMonth } from "@/lib/research/expense-line-items";
import type {
  ExpenseLineItem,
  FinancialAssumptions,
  FinancialIncomeDrivers,
  FinancialMonthlyPlans,
  FinancialScenario,
  MonthlyExpenseRow,
  MonthlyIncomeRow,
  MonthlyProjection,
  OnboardingProfile,
} from "@/lib/types/domain";

export function defaultIncomeDrivers(
  profile: OnboardingProfile,
  scenario: FinancialScenario,
): FinancialIncomeDrivers {
  const isInr = profile.currency === "INR";
  const lowEach = isInr ? 15_000 : 500;
  const highAmt = isInr ? 500_000 : 15_000;
  const whaleAmt = isInr ? 2_000_000 : 75_000;
  const mult = scenario === "ambitious" ? 1.35 : 0.7;

  return {
    lowTicketClientsPerMonth: scenario === "ambitious" ? 3 : 1,
    lowTicketMrrEach: Math.round(lowEach * mult),
    highTicketsPerYear: 3,
    highTicketAmount: Math.round(highAmt * mult),
    whalesPerYear: 1,
    whaleAmount: Math.round(whaleAmt * mult),
    monthlyChurnRate: 0.05,
  };
}

/** Months (1-based) that receive high-ticket or whale cash for the horizon. */
export function distributeDealMonths(
  months: number,
  countPerYear: number,
): number[] {
  if (countPerYear <= 0 || months <= 0) return [];
  const out: number[] = [];
  const step = Math.max(1, Math.floor(months / countPerYear));
  for (let i = 0; i < countPerYear; i++) {
    const m = Math.min(months, 1 + i * step + Math.floor(step / 2));
    if (!out.includes(m)) out.push(m);
  }
  return out.sort((a, b) => a - b);
}

export function buildDefaultExpenseTable(
  profile: OnboardingProfile,
  lineItems: ExpenseLineItem[],
): MonthlyExpenseRow[] {
  const months = Math.max(1, Math.min(50, profile.goalMonths));
  return Array.from({ length: months }, (_, i) => {
    const month = i + 1;
    const { total } = expenseForMonth(lineItems, month);
    return { month, totalExpenses: Math.round(total) };
  });
}

function rowLowMrr(row: MonthlyIncomeRow): number {
  return Math.max(0, Math.round(row.lowTicketMrr));
}

function simulateEndMrr(
  profile: OnboardingProfile,
  incomeRows: MonthlyIncomeRow[],
  churn: number,
): number {
  let mrr = profile.currentMrr;
  for (const row of incomeRows) {
    mrr = Math.round(mrr * (1 - churn) + rowLowMrr(row));
  }
  return mrr;
}

function calibrateIncomeRows(
  profile: OnboardingProfile,
  rows: MonthlyIncomeRow[],
  targetEndMrr: number,
  churn: number,
): MonthlyIncomeRow[] {
  let scale = 1;
  let calibrated = rows;
  for (let i = 0; i < 12; i++) {
    const scaled = rows.map((r) => ({
      ...r,
      lowTicketMrr: Math.round(rowLowMrr(r) * scale),
    }));
    const end = simulateEndMrr(profile, scaled, churn);
    if (Math.abs(end - targetEndMrr) < Math.max(100, targetEndMrr * 0.02)) {
      calibrated = scaled;
      break;
    }
    scale *= targetEndMrr / Math.max(end, 1);
    calibrated = scaled;
  }
  return calibrated;
}

export function buildDefaultIncomeTable(
  profile: OnboardingProfile,
  drivers: FinancialIncomeDrivers,
  scenario: FinancialScenario,
): MonthlyIncomeRow[] {
  const months = Math.max(1, Math.min(50, profile.goalMonths));
  const highMonths = distributeDealMonths(months, drivers.highTicketsPerYear);
  const whaleMonths = distributeDealMonths(months, drivers.whalesPerYear);

  const gap = profile.targetMrr - profile.currentMrr;
  const endTarget =
    scenario === "ambitious"
      ? Math.round(profile.currentMrr + gap * 0.95)
      : Math.round(profile.currentMrr + gap * 0.55);

  const rows: MonthlyIncomeRow[] = [];
  for (let m = 1; m <= months; m++) {
    const ramp = scenario === "ambitious" ? 1 + (m / months) * 0.6 : 1 + (m / months) * 0.25;
    const clients = Math.max(
      0,
      Math.round(drivers.lowTicketClientsPerMonth * ramp),
    );
    const lowTicketMrr = Math.round(clients * drivers.lowTicketMrrEach);
    rows.push({
      month: m,
      lowTicketClients: clients,
      lowTicketMrr,
      highTicketCash: highMonths.includes(m) ? drivers.highTicketAmount : 0,
      whaleCash: whaleMonths.includes(m) ? drivers.whaleAmount : 0,
    });
  }

  return calibrateIncomeRows(profile, rows, endTarget, drivers.monthlyChurnRate);
}

export function buildDefaultMonthlyPlans(
  profile: OnboardingProfile,
  assumptions: FinancialAssumptions,
): FinancialMonthlyPlans {
  const driversConservative = defaultIncomeDrivers(profile, "conservative");
  const driversAmbitious = defaultIncomeDrivers(profile, "ambitious");
  const lineItems = assumptions.expenseLineItems ?? [];

  return {
    conservative: buildDefaultIncomeTable(profile, driversConservative, "conservative"),
    ambitious: buildDefaultIncomeTable(profile, driversAmbitious, "ambitious"),
    expenses: buildDefaultExpenseTable(profile, lineItems),
    activeScenario: "ambitious",
    incomeDrivers: {
      conservative: driversConservative,
      ambitious: driversAmbitious,
    },
  };
}

export type TimelineResult = {
  projections: MonthlyProjection[];
  finalMrr: number;
  mrrSeries: number[];
};

export function computeTimeline(
  profile: OnboardingProfile,
  assumptions: FinancialAssumptions,
  incomeRows: MonthlyIncomeRow[],
  expenseRows: MonthlyExpenseRow[],
  churn = 0.05,
): TimelineResult {
  const months = Math.max(1, Math.min(50, profile.goalMonths));
  const lineItems = assumptions.expenseLineItems ?? [];
  const projections: MonthlyProjection[] = [];
  const mrrSeries: number[] = [];
  let mrr = profile.currentMrr;
  let cumulativeMrr = 0;

  for (let m = 1; m <= months; m++) {
    const income = incomeRows.find((r) => r.month === m) ?? {
      month: m,
      lowTicketClients: 0,
      lowTicketMrr: 0,
      highTicketCash: 0,
      whaleCash: 0,
    };
    const expenseRow = expenseRows.find((r) => r.month === m);
    const breakdown = expenseForMonth(lineItems, m);
    const expenses = Math.round(
      expenseRow?.totalExpenses ?? breakdown.total,
    );

    mrr = Math.round(mrr * (1 - churn) + rowLowMrr(income));
    const cashCollected = Math.round(
      rowLowMrr(income) + income.highTicketCash + income.whaleCash,
    );
    const profit = cashCollected - expenses;
    cumulativeMrr += mrr;
    mrrSeries.push(mrr);

    projections.push({
      month: m,
      revenue: mrr,
      recurringMrr: mrr,
      cashCollected,
      cumulativeRevenue: Math.round(cumulativeMrr),
      expenses,
      investment: expenses,
      pipelineNeeded: Math.max(0, Math.round(profile.targetMrr - mrr)),
      netCash: profit,
      netMrr: profit,
      newContracts: {
        lowTicket: income.lowTicketClients,
        midTicket: 0,
        highTicket: income.highTicketCash > 0 ? 1 : 0,
        whale: income.whaleCash > 0 ? 1 : 0,
        newRetainers: 0,
      },
      expenseByCategory: breakdown.byCategory,
      expenseByLineItem: breakdown.byLine,
    });
  }

  return {
    projections,
    finalMrr: mrr,
    mrrSeries,
  };
}

export function computeBothScenarios(
  profile: OnboardingProfile,
  assumptions: FinancialAssumptions,
  plans: FinancialMonthlyPlans,
): {
  conservative: TimelineResult;
  ambitious: TimelineResult;
  active: TimelineResult;
} {
  const churnConservative =
    plans.incomeDrivers?.conservative.monthlyChurnRate ?? 0.05;
  const churnAmbitious = plans.incomeDrivers?.ambitious.monthlyChurnRate ?? 0.05;

  const conservative = computeTimeline(
    profile,
    assumptions,
    plans.conservative,
    plans.expenses,
    churnConservative,
  );
  const ambitious = computeTimeline(
    profile,
    assumptions,
    plans.ambitious,
    plans.expenses,
    churnAmbitious,
  );
  const active =
    plans.activeScenario === "conservative" ? conservative : ambitious;

  return { conservative, ambitious, active };
}

/** Merge AI/partial income rows with defaults for missing months. */
export function normalizeIncomeRows(
  profile: OnboardingProfile,
  partial: MonthlyIncomeRow[] | undefined,
  scenario: FinancialScenario,
  drivers?: FinancialIncomeDrivers,
): MonthlyIncomeRow[] {
  const d = drivers ?? defaultIncomeDrivers(profile, scenario);
  const defaults = buildDefaultIncomeTable(profile, d, scenario);
  if (!partial?.length) return defaults;

  const months = Math.max(1, Math.min(50, profile.goalMonths));
  return Array.from({ length: months }, (_, i) => {
    const month = i + 1;
    const fromAi = partial.find((r) => r.month === month);
    const base = defaults.find((r) => r.month === month)!;
    if (!fromAi) return base;
    return {
      month,
      lowTicketClients: Number(fromAi.lowTicketClients) || base.lowTicketClients,
      lowTicketMrr: Number(fromAi.lowTicketMrr) || base.lowTicketMrr,
      highTicketCash: Number(fromAi.highTicketCash) ?? base.highTicketCash,
      whaleCash: Number(fromAi.whaleCash) ?? base.whaleCash,
      userEdited: fromAi.userEdited,
    };
  });
}

export function normalizeMonthlyPlans(
  profile: OnboardingProfile,
  assumptions: FinancialAssumptions,
  partial?: Partial<FinancialMonthlyPlans>,
): FinancialMonthlyPlans {
  const defaults = buildDefaultMonthlyPlans(profile, assumptions);
  if (!partial) return defaults;

  const driversConservative =
    partial.incomeDrivers?.conservative ??
    defaults.incomeDrivers!.conservative;
  const driversAmbitious =
    partial.incomeDrivers?.ambitious ?? defaults.incomeDrivers!.ambitious;

  const expenses =
    partial.expenses?.length === defaults.expenses.length
      ? partial.expenses.map((e, i) => ({
          month: e.month ?? i + 1,
          totalExpenses: Math.round(
            Number(e.totalExpenses) || defaults.expenses[i]!.totalExpenses,
          ),
          userEdited: e.userEdited,
        }))
      : defaults.expenses;

  return {
    conservative: normalizeIncomeRows(
      profile,
      partial.conservative,
      "conservative",
      driversConservative,
    ),
    ambitious: normalizeIncomeRows(
      profile,
      partial.ambitious,
      "ambitious",
      driversAmbitious,
    ),
    expenses,
    activeScenario:
      partial.activeScenario === "conservative" ? "conservative" : "ambitious",
    incomeDrivers: {
      conservative: driversConservative,
      ambitious: driversAmbitious,
    },
  };
}
