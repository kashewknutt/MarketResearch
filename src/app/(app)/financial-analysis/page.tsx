"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { ExpenseLineItemsEditor } from "@/components/expense-line-items-editor";
import {
  FinancialMrrChart,
  FinancialProfitChart,
} from "@/components/financial-projection-chart";
import { MonthlyExpenseTable } from "@/components/monthly-expense-table";
import { MonthlyIncomeTable } from "@/components/monthly-income-table";
import { GeminiFallback } from "@/components/gemini-fallback";
import { MetricCard } from "@/components/ui/metric-card";
import { formatMoney } from "@/lib/currency";
import {
  buildDefaultExpenseTable,
  computeBothScenarios,
} from "@/lib/research/financial-timeline-engine";
import { buildProjections } from "@/lib/research/projection-engine";
import { syncLegacySpendFields } from "@/lib/research/expense-line-items";
import type {
  FinancialAssumptions,
  FinancialMonthlyPlans,
  FinancialScenario,
  FinancialSnapshot,
  OnboardingProfile,
} from "@/lib/types/domain";

export default function FinancialAnalysisPage() {
  const [stored, setStored] = useState<FinancialSnapshot | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [assumptions, setAssumptions] = useState<FinancialAssumptions | null>(null);
  const [monthlyPlans, setMonthlyPlans] = useState<FinancialMonthlyPlans | null>(null);
  const [incomeTab, setIncomeTab] = useState<FinancialScenario>("ambitious");

  const loadFinancial = useCallback(() => {
    fetch("/api/financial")
      .then((r) => r.json())
      .then((d) => {
        setStored(d.financial);
        setProfile(d.profile ?? null);
        if (d.financial?.assumptions?.value) {
          setAssumptions(d.financial.assumptions.value);
        }
        if (d.financial?.monthlyPlans) {
          setMonthlyPlans(d.financial.monthlyPlans);
          setIncomeTab(d.financial.monthlyPlans.activeScenario);
        } else if (d.financial?.assumptions?.value && d.profile) {
          const seeded = buildProjections(
            d.profile,
            d.financial.assumptions.value,
            d.financial.narrative,
            d.financial.leverageVariables,
          ).monthlyPlans;
          if (seeded) {
            setMonthlyPlans(seeded);
            setIncomeTab(seeded.activeScenario);
          }
        }
      });
  }, []);

  useEffect(() => {
    loadFinancial();
  }, [loadFinancial]);

  useAppRefresh(loadFinancial, ["financial", "all"]);

  const financial = useMemo(() => {
    if (!profile || !assumptions) return stored;
    return buildProjections(
      profile,
      assumptions,
      stored?.narrative,
      stored?.leverageVariables,
      monthlyPlans ?? undefined,
    );
  }, [profile, assumptions, stored, monthlyPlans]);

  const scenarioEnds = useMemo(() => {
    if (!profile || !assumptions || !financial?.monthlyPlans) return null;
    const { conservative, ambitious } = computeBothScenarios(
      profile,
      assumptions,
      financial.monthlyPlans,
    );
    return {
      conservative: conservative.finalMrr,
      ambitious: ambitious.finalMrr,
    };
  }, [profile, assumptions, financial?.monthlyPlans]);

  const updateExpenseItems = useCallback(
    (items: FinancialAssumptions["expenseLineItems"]) => {
      setAssumptions((prev) => {
        if (!prev) return prev;
        const next = syncLegacySpendFields({ ...prev, expenseLineItems: items });
        if (profile) {
          setMonthlyPlans((plans) =>
            plans
              ? {
                  ...plans,
                  expenses: buildDefaultExpenseTable(profile, items),
                }
              : plans,
          );
        }
        return next;
      });
    },
    [profile],
  );

  const updatePlans = useCallback((patch: Partial<FinancialMonthlyPlans>) => {
    setMonthlyPlans((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const setActiveScenario = (scenario: FinancialScenario) => {
    setIncomeTab(scenario);
    updatePlans({ activeScenario: scenario });
  };

  const resetExpenseMonth = (month: number) => {
    if (!profile || !assumptions || !monthlyPlans) return;
    const computed = buildDefaultExpenseTable(
      profile,
      assumptions.expenseLineItems ?? [],
    );
    const row = computed.find((r) => r.month === month);
    if (!row) return;
    updatePlans({
      expenses: monthlyPlans.expenses.map((r) =>
        r.month === month ? { ...row, userEdited: false } : r,
      ),
    });
  };

  const persist = async () => {
    if (!assumptions || !monthlyPlans) return;
    await fetch("/api/financial", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assumptions, monthlyPlans }),
    });
    const res = await fetch("/api/financial");
    const d = await res.json();
    setStored(d.financial);
    if (d.financial?.monthlyPlans) setMonthlyPlans(d.financial.monthlyPlans);
  };

  if (!financial || !profile || !assumptions || !financial.monthlyPlans) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Financial Analysis</h1>
        <GeminiFallback title="Run research to generate financial analysis" verify />
      </div>
    );
  }

  const currency = profile.currency;
  const money = (n: number) => formatMoney(n, currency);
  const plans = monthlyPlans ?? financial.monthlyPlans!;
  const displayAssumptions = assumptions;

  const avgProfit =
    financial.projections.reduce(
      (s, p) =>
        s +
        (p.netCash ??
          p.netMrr ??
          (p.cashCollected ?? 0) - (p.expenses ?? p.investment)),
      0,
    ) / Math.max(1, financial.projections.length);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Financial Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">{financial.narrative}</p>
        <p className="mt-2 text-xs text-slate-500">
          Edit monthly expense and income tables (Conservative vs Ambitious). MRR builds from
          recurring low-ticket adds each month; high-ticket (~3/year) and whale deals add lumpy
          cash. Charts use the active scenario below.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="End MRR (active)"
          value={money(
            financial.projections[financial.projections.length - 1]?.recurringMrr ??
              financial.projections[financial.projections.length - 1]?.revenue ??
              0,
          )}
          currency={currency}
        />
        <MetricCard
          label="Target MRR"
          value={money(profile.targetMrr)}
          currency={currency}
        />
        <MetricCard
          label="Gap to target"
          value={money(financial.gapToGoal)}
          currency={currency}
        />
        <MetricCard
          label="Avg monthly profit"
          value={money(Math.round(avgProfit))}
          currency={currency}
        />
      </div>

      {scenarioEnds && (
        <p className="text-xs text-slate-600">
          End MRR — Conservative: {money(scenarioEnds.conservative)} · Ambitious:{" "}
          {money(scenarioEnds.ambitious)}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Step 1 — Expense line items
        </h2>
        <ExpenseLineItemsEditor
          items={displayAssumptions.expenseLineItems ?? []}
          currency={currency}
          onChange={updateExpenseItems}
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Step 2 — Monthly expenses ({currency})
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!profile) return;
              updatePlans({
                expenses: buildDefaultExpenseTable(
                  profile,
                  displayAssumptions.expenseLineItems ?? [],
                ),
              });
            }}
            className="text-xs text-violet-600 hover:underline"
          >
            Reset all from line items
          </button>
        </div>
        <MonthlyExpenseTable
          rows={plans.expenses}
          currency={currency}
          onChange={(expenses) => updatePlans({ expenses })}
          onResetMonth={resetExpenseMonth}
        />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Step 3 — Monthly income ({currency})
          </h2>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
            {(["conservative", "ambitious"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setIncomeTab(s)}
                className={`rounded-md px-3 py-1 capitalize ${
                  incomeTab === s
                    ? "bg-violet-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <MonthlyIncomeTable
          rows={incomeTab === "conservative" ? plans.conservative : plans.ambitious}
          currency={currency}
          onChange={(rows) =>
            updatePlans(
              incomeTab === "conservative"
                ? { conservative: rows }
                : { ambitious: rows },
            )
          }
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Step 4 — Scenario for charts
        </h2>
        <div className="flex flex-wrap gap-4 text-sm">
          {(["conservative", "ambitious"] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 capitalize">
              <input
                type="radio"
                name="activeScenario"
                checked={plans.activeScenario === s}
                onChange={() => setActiveScenario(s)}
              />
              {s}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void persist()}
          className="mt-4 rounded-lg bg-violet-500 px-4 py-2 text-sm text-white hover:bg-violet-600"
        >
          Save to database
        </button>
      </section>

      {financial.linkedInAdHistory && (
        <section className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
          <h2 className="text-sm font-semibold text-slate-700">LinkedIn ad spend</h2>
          <p className="mt-1 text-xs text-slate-600">{financial.linkedInAdHistory.message}</p>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            MRR timeline ({plans.activeScenario})
          </h2>
          <FinancialMrrChart
            projections={financial.projections}
            currency={currency}
            targetMrr={profile.targetMrr}
            scenarioLabel={`Active: ${plans.activeScenario}`}
          />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Monthly profit</h2>
          <FinancialProfitChart
            projections={financial.projections}
            currency={currency}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Monthly detail</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2">Cash in</th>
                <th className="px-4 py-2">MRR</th>
                <th className="px-4 py-2">Expenses</th>
                <th className="px-4 py-2">Profit</th>
              </tr>
            </thead>
            <tbody>
              {financial.projections.map((p) => (
                <tr key={p.month} className="border-t border-slate-50">
                  <td className="px-4 py-2">{p.month}</td>
                  <td className="px-4 py-2">{money(p.cashCollected ?? 0)}</td>
                  <td className="px-4 py-2">{money(p.recurringMrr ?? p.revenue)}</td>
                  <td className="px-4 py-2">{money(p.expenses ?? p.investment)}</td>
                  <td className="px-4 py-2">
                    {money(
                      p.netCash ??
                        p.netMrr ??
                        (p.cashCollected ?? 0) - (p.expenses ?? p.investment),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
