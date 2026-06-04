import { distributeDealMonths } from "@/lib/research/financial-timeline-engine";
import {
  defaultMetricsForDomain,
  emptyScenarioValues,
} from "@/lib/research/financial-metric-templates";
import type {
  FinancialMetricDefinition,
  FinancialMetricWorkbook,
  FinancialMonthlyPlans,
  FinancialScenario,
  FinancialScenarioValues,
  MonthlyPlSummary,
  MonthlyProjection,
  OnboardingProfile,
} from "@/lib/types/domain";

const DEFAULT_CHURN = 0.05;

export function getMetricByLabel(
  metrics: FinancialMetricDefinition[],
  pattern: RegExp,
): FinancialMetricDefinition | undefined {
  return metrics.find((m) => pattern.test(m.label));
}

function monthCount(profile: OnboardingProfile): number {
  return Math.max(1, Math.min(50, profile.goalMonths));
}

function ensureValuesLength(
  values: number[],
  months: number,
): number[] {
  const out = [...values];
  while (out.length < months) out.push(0);
  return out.slice(0, months);
}

export function computePlMonth(
  metrics: FinancialMetricDefinition[],
  scenarioValues: FinancialScenarioValues,
  monthIndex: number,
): Omit<MonthlyPlSummary, "month" | "recurringMrr"> {
  let totalRevenue = 0;
  let totalExpenses = 0;
  for (const m of metrics) {
    const v = Math.round(scenarioValues[m.id]?.[monthIndex] ?? 0);
    if (m.kind === "revenue") totalRevenue += v;
    else totalExpenses += v;
  }
  const ebitda = totalRevenue - totalExpenses;
  const profitMarginPct =
    totalRevenue > 0 ? ebitda / totalRevenue : 0;
  return {
    totalRevenue,
    totalExpenses,
    ebitda,
    netProfit: ebitda,
    profitMarginPct,
  };
}

export function computeRecurringMrrSeries(
  profile: OnboardingProfile,
  metrics: FinancialMetricDefinition[],
  scenarioValues: FinancialScenarioValues,
  churn: number,
): number[] {
  const months = monthCount(profile);
  const recurring = metrics.filter((m) => m.kind === "revenue" && m.recurring);
  let mrr = profile.currentMrr;
  const series: number[] = [];
  for (let i = 0; i < months; i++) {
    const add = recurring.reduce(
      (s, m) => s + Math.round(scenarioValues[m.id]?.[i] ?? 0),
      0,
    );
    mrr = Math.round(mrr * (1 - churn) + add);
    series.push(mrr);
  }
  return series;
}

export function computePlSummaries(
  profile: OnboardingProfile,
  workbook: FinancialMetricWorkbook,
  scenario: FinancialScenario,
): MonthlyPlSummary[] {
  const months = monthCount(profile);
  const values = workbook[scenario];
  const churn = workbook.monthlyChurnRate ?? DEFAULT_CHURN;
  const mrrSeries = computeRecurringMrrSeries(
    profile,
    workbook.metrics,
    values,
    churn,
  );

  return Array.from({ length: months }, (_, i) => {
    const base = computePlMonth(workbook.metrics, values, i);
    return {
      month: i + 1,
      ...base,
      recurringMrr: mrrSeries[i],
    };
  });
}

export function summariesToProjections(
  summaries: MonthlyPlSummary[],
): MonthlyProjection[] {
  let cumulativeMrr = 0;
  return summaries.map((s) => {
    const mrr = s.recurringMrr ?? s.totalRevenue;
    cumulativeMrr += mrr;
    return {
      month: s.month,
      revenue: mrr,
      recurringMrr: mrr,
      cashCollected: s.totalRevenue,
      totalRevenue: s.totalRevenue,
      totalExpenses: s.totalExpenses,
      ebitda: s.ebitda,
      profitMarginPct: s.profitMarginPct,
      cumulativeRevenue: Math.round(cumulativeMrr),
      expenses: s.totalExpenses,
      investment: s.totalExpenses,
      pipelineNeeded: 0,
      netCash: s.netProfit,
      netMrr: s.netProfit,
    };
  });
}

export type PlScenarioResult = {
  summaries: MonthlyPlSummary[];
  projections: MonthlyProjection[];
  finalMrr: number;
  mrrSeries: number[];
};

export function computePlScenario(
  profile: OnboardingProfile,
  workbook: FinancialMetricWorkbook,
  scenario: FinancialScenario,
): PlScenarioResult {
  const summaries = computePlSummaries(profile, workbook, scenario);
  const projections = summariesToProjections(summaries);
  const mrrSeries = summaries.map((s) => s.recurringMrr ?? s.totalRevenue);
  const finalMrr = mrrSeries[mrrSeries.length - 1] ?? profile.currentMrr;
  return { summaries, projections, finalMrr, mrrSeries };
}

export function computePlBothScenarios(
  profile: OnboardingProfile,
  workbook: FinancialMetricWorkbook,
): {
  conservative: PlScenarioResult;
  ambitious: PlScenarioResult;
  active: PlScenarioResult;
} {
  const conservative = computePlScenario(profile, workbook, "conservative");
  const ambitious = computePlScenario(profile, workbook, "ambitious");
  const active =
    workbook.activeScenario === "conservative" ? conservative : ambitious;
  return { conservative, ambitious, active };
}

function defaultAmountsForMetric(
  profile: OnboardingProfile,
  m: FinancialMetricDefinition,
  scenario: FinancialScenario,
  monthIndex: number,
  months: number,
  enterpriseMonths: number[],
  whale1Months: number[],
  whale2Months: number[],
): number {
  const isInr = profile.currency === "INR";
  const mult = scenario === "ambitious" ? 1.35 : 0.7;
  const month = monthIndex + 1;

  if (m.recurring && m.kind === "revenue") {
    const base = isInr ? 60_000 : 2_000;
    const ramp = 1 + (monthIndex / months) * (scenario === "ambitious" ? 0.4 : 0.15);
    return Math.round(base * mult * ramp);
  }
  if (/enterprise/i.test(m.label) && m.kind === "revenue") {
    return enterpriseMonths.includes(month)
      ? Math.round((isInr ? 200_000 : 8_000) * mult)
      : 0;
  }
  if (/huge client 1/i.test(m.label)) {
    return whale1Months.includes(month)
      ? Math.round((isInr ? 300_000 : 12_000) * mult)
      : 0;
  }
  if (/huge client 2|large deal/i.test(m.label)) {
    return whale2Months.includes(month)
      ? Math.round((isInr ? 250_000 : 10_000) * mult)
      : 0;
  }
  if (/project|campaign/i.test(m.label) && m.kind === "revenue") {
    return month % 4 === 0
      ? Math.round((isInr ? 80_000 : 3_000) * mult)
      : 0;
  }

  if (m.kind === "expense") {
    if (/salaries|payroll/i.test(m.label)) {
      return Math.round((isInr ? 150_000 : 5_000) * (scenario === "ambitious" ? 1.1 : 1));
    }
    if (/founder/i.test(m.label)) {
      return Math.round((isInr ? 50_000 : 2_000) * mult);
    }
    if (/marketing spend|paid ads|linkedin/i.test(m.label)) {
      return 0;
    }
    return Math.round((isInr ? 10_000 : 400) * (scenario === "ambitious" ? 1.05 : 1));
  }

  return 0;
}

function applyMarketingPctOfRevenue(
  metrics: FinancialMetricDefinition[],
  values: FinancialScenarioValues,
  months: number,
  pct = 0.08,
): void {
  const marketing = metrics.find(
    (m) => m.kind === "expense" && /marketing spend/i.test(m.label),
  );
  if (!marketing) return;
  for (let i = 0; i < months; i++) {
    const rev = computePlMonth(metrics, values, i).totalRevenue;
    values[marketing.id]![i] = Math.round(rev * pct);
  }
}

function calibrateRecurringRevenue(
  profile: OnboardingProfile,
  metrics: FinancialMetricDefinition[],
  values: FinancialScenarioValues,
  scenario: FinancialScenario,
  targetEndMrr: number,
  churn: number,
): void {
  const recurring = metrics.find((m) => m.recurring && m.kind === "revenue");
  if (!recurring) return;

  let scale = 1;
  for (let iter = 0; iter < 12; iter++) {
    const scaled: FinancialScenarioValues = { ...values };
    const months = values[recurring.id]!.length;
    scaled[recurring.id] = values[recurring.id]!.map((v) =>
      Math.round(v * scale),
    );
    const series = computeRecurringMrrSeries(
      profile,
      metrics,
      scaled,
      churn,
    );
    const end = series[series.length - 1] ?? profile.currentMrr;
    if (Math.abs(end - targetEndMrr) < Math.max(100, targetEndMrr * 0.03)) {
      values[recurring.id] = scaled[recurring.id]!;
      break;
    }
    scale *= targetEndMrr / Math.max(end, 1);
    values[recurring.id] = values[recurring.id]!.map((v) =>
      Math.round(v * scale),
    );
  }
}

export function buildDefaultScenarioValues(
  profile: OnboardingProfile,
  metrics: FinancialMetricDefinition[],
  scenario: FinancialScenario,
): FinancialScenarioValues {
  const months = monthCount(profile);
  const values = emptyScenarioValues(metrics, months);
  const enterpriseMonths = distributeDealMonths(months, 3);
  const whale1Months = distributeDealMonths(months, 1);
  const whale2Months = distributeDealMonths(
    months,
    scenario === "ambitious" ? 1 : 0,
  );

  for (let i = 0; i < months; i++) {
    for (const m of metrics) {
      values[m.id]![i] = defaultAmountsForMetric(
        profile,
        m,
        scenario,
        i,
        months,
        enterpriseMonths,
        whale1Months,
        whale2Months,
      );
    }
  }

  applyMarketingPctOfRevenue(metrics, values, months);

  const gap = profile.targetMrr - profile.currentMrr;
  const endTarget =
    scenario === "ambitious"
      ? Math.round(profile.currentMrr + gap * 0.95)
      : Math.round(profile.currentMrr + gap * 0.55);
  calibrateRecurringRevenue(
    profile,
    metrics,
    values,
    scenario,
    endTarget,
    DEFAULT_CHURN,
  );
  applyMarketingPctOfRevenue(metrics, values, months);

  return values;
}

export function buildDefaultWorkbook(
  profile: OnboardingProfile,
): FinancialMetricWorkbook {
  const metrics = defaultMetricsForDomain(profile);
  return {
    metrics,
    conservative: buildDefaultScenarioValues(profile, metrics, "conservative"),
    ambitious: buildDefaultScenarioValues(profile, metrics, "ambitious"),
    activeScenario: "ambitious",
    monthlyChurnRate: DEFAULT_CHURN,
  };
}

export function migrateMonthlyPlansToWorkbook(
  profile: OnboardingProfile,
  plans: FinancialMonthlyPlans,
): FinancialMetricWorkbook {
  const months = monthCount(profile);
  const metrics = defaultMetricsForDomain(profile);
  const small = getMetricByLabel(metrics, /small|recurring|retainer/i);
  const enterprise = getMetricByLabel(metrics, /enterprise|project|campaign/i);
  const whale1 = getMetricByLabel(metrics, /huge client 1|large deal/i);
  const whale2 = getMetricByLabel(metrics, /huge client 2/i);

  const buildFromIncome = (
    rows: FinancialMonthlyPlans["conservative"],
    expenses: FinancialMonthlyPlans["expenses"],
  ): FinancialScenarioValues => {
    const values = emptyScenarioValues(metrics, months);
    for (let i = 0; i < months; i++) {
      const row = rows.find((r) => r.month === i + 1) ?? rows[i];
      const exp = expenses.find((e) => e.month === i + 1) ?? expenses[i];
      if (small && row) values[small.id]![i] = row.lowTicketMrr;
      if (enterprise && row) {
        values[enterprise.id]![i] =
          (values[enterprise.id]![i] ?? 0) + row.highTicketCash;
      }
      if (whale1 && row) values[whale1.id]![i] = row.whaleCash;
      if (whale2 && row) values[whale2.id]![i] = 0;
      const expTotal = exp?.totalExpenses ?? 0;
      const expenseMetrics = metrics.filter((m) => m.kind === "expense");
      const perLine =
        expenseMetrics.length > 0
          ? Math.round(expTotal / expenseMetrics.length)
          : 0;
      for (const em of expenseMetrics) {
        values[em.id]![i] = perLine;
      }
    }
    applyMarketingPctOfRevenue(metrics, values, months);
    return values;
  };

  return {
    metrics,
    conservative: buildFromIncome(plans.conservative, plans.expenses),
    ambitious: buildFromIncome(plans.ambitious, plans.expenses),
    activeScenario: plans.activeScenario,
    monthlyChurnRate:
      plans.incomeDrivers?.conservative.monthlyChurnRate ?? DEFAULT_CHURN,
  };
}

export function normalizeMetricWorkbook(
  profile: OnboardingProfile,
  partial?: Partial<FinancialMetricWorkbook>,
  legacyPlans?: FinancialMonthlyPlans,
): FinancialMetricWorkbook {
  const defaults = buildDefaultWorkbook(profile);
  if (!partial && legacyPlans) {
    return migrateMonthlyPlansToWorkbook(profile, legacyPlans);
  }
  if (!partial) return defaults;

  const months = monthCount(profile);
  const metrics =
    partial.metrics?.length && partial.metrics.every((m) => m.id && m.label)
      ? partial.metrics.map((m, i) => ({
          ...m,
          order: m.order ?? i * 10,
        }))
      : defaults.metrics;

  const mergeScenario = (
    src: FinancialScenarioValues | undefined,
    fallback: FinancialScenarioValues,
  ): FinancialScenarioValues => {
    const out = { ...fallback };
    for (const m of metrics) {
      const from = src?.[m.id];
      out[m.id] = ensureValuesLength(
        from ?? fallback[m.id] ?? [],
        months,
      );
    }
    return out;
  };

  return {
    metrics,
    conservative: mergeScenario(
      partial.conservative,
      defaults.conservative,
    ),
    ambitious: mergeScenario(partial.ambitious, defaults.ambitious),
    activeScenario:
      partial.activeScenario === "conservative" ? "conservative" : "ambitious",
    monthlyChurnRate: partial.monthlyChurnRate ?? DEFAULT_CHURN,
  };
}
