"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExpenseLineItemsEditor } from "@/components/expense-line-items-editor";
import { FinancialProjectionChart } from "@/components/financial-projection-chart";
import { EditableField } from "@/components/editable-field";
import {
  migrateAssumptionsToLineItems,
  syncLegacySpendFields,
} from "@/lib/research/expense-line-items";
import { GeminiFallback } from "@/components/gemini-fallback";
import { MetricCard } from "@/components/ui/metric-card";
import { formatMoney } from "@/lib/currency";
import { buildProjections } from "@/lib/research/projection-engine";
import type {
  FinancialAssumptions,
  FinancialSnapshot,
  OnboardingProfile,
} from "@/lib/types/domain";

export default function FinancialAnalysisPage() {
  const [stored, setStored] = useState<FinancialSnapshot | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [assumptions, setAssumptions] = useState<FinancialAssumptions | null>(null);

  useEffect(() => {
    fetch("/api/financial")
      .then((r) => r.json())
      .then((d) => {
        setStored(d.financial);
        setProfile(d.profile ?? null);
        if (d.financial?.assumptions?.value && d.profile) {
          const defaults = migrateAssumptionsToLineItems(
            {},
            d.profile,
            d.financial.assumptions.value,
          );
          setAssumptions(
            migrateAssumptionsToLineItems(
              d.financial.assumptions.value,
              d.profile,
              defaults,
            ),
          );
        }
      });
  }, []);

  const financial = useMemo(() => {
    if (!profile || !assumptions) return stored;
    return buildProjections(
      profile,
      assumptions,
      stored?.narrative,
      stored?.leverageVariables,
    );
  }, [profile, assumptions, stored]);

  const updateAssumption = useCallback((key: keyof FinancialAssumptions, value: number) => {
    setAssumptions((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  const updateExpenseItems = useCallback(
    (items: FinancialAssumptions["expenseLineItems"]) => {
      setAssumptions((prev) =>
        prev ? syncLegacySpendFields({ ...prev, expenseLineItems: items }) : prev,
      );
    },
    [],
  );

  const persistAssumptions = async () => {
    if (!assumptions) return;
    await fetch("/api/financial", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assumptions }),
    });
    const res = await fetch("/api/financial");
    const d = await res.json();
    setStored(d.financial);
  };

  if (!financial || !profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Financial Analysis</h1>
        <GeminiFallback title="Run research to generate financial analysis" verify />
      </div>
    );
  }

  const currency = profile.currency;
  const money = (n: number) => formatMoney(n, currency);
  const a = financial.assumptions;
  const display = assumptions ?? a.value;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Financial Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">{financial.narrative}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Gap to target MRR"
          value={money(financial.gapToGoal)}
          currency={currency}
        />
        <MetricCard
          label="Required MRR growth / month"
          value={money(financial.monthlyPaceRequired)}
          currency={currency}
          hint="Linear path from current to target"
        />
        <MetricCard
          label="Horizon"
          value={`${financial.projections.length} months`}
          currency={currency}
        />
      </div>

      {financial.linkedInAdHistory && (
        <section className="rounded-xl border border-sky-100 bg-sky-50/50 p-4">
          <h2 className="text-sm font-semibold text-slate-700">LinkedIn ad spend</h2>
          <p className="mt-1 text-xs text-slate-600">{financial.linkedInAdHistory.message}</p>
          {financial.linkedInAdHistory.available &&
            financial.linkedInAdHistory.monthlySpend.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {financial.linkedInAdHistory.monthlySpend.map((m) => (
                  <span
                    key={m.month}
                    className="rounded-md bg-white px-2 py-1 text-xs text-slate-700 shadow-sm"
                  >
                    {m.month}: {formatMoney(m.amount, m.currency || currency)}
                  </span>
                ))}
                {financial.linkedInAdHistory.totalLast12Months != null && (
                  <span className="rounded-md bg-sky-100 px-2 py-1 text-xs font-medium text-sky-900">
                    12-mo total:{" "}
                    {formatMoney(
                      financial.linkedInAdHistory.totalLast12Months,
                      financial.linkedInAdHistory.currency || currency,
                    )}
                  </span>
                )}
              </div>
            )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Monthly expense line items
        </h2>
        <ExpenseLineItemsEditor
          items={display.expenseLineItems ?? []}
          currency={currency}
          onChange={updateExpenseItems}
        />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Pipeline assumptions (chart updates live)
          </h2>
          <button
            type="button"
            onClick={() => void persistAssumptions()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            Save to database
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["closeRate", display.closeRate],
              ["leadVolume", display.leadVolume],
              ["leadToCallRate", display.leadToCallRate],
              ["callToCloseRate", display.callToCloseRate],
              ["averageTicketUs", display.averageTicketUs],
              ["averageTicketIndia", display.averageTicketIndia],
              ["hiringCost", display.hiringCost],
              ["hiringMonth", display.hiringMonth],
            ] as const
          ).map(([key, val]) => (
            <EditableField
              key={key}
              label={`${key} (${currency} where $)`}
              value={val}
              type="number"
              provenance={a.isUserEdited ? "user" : a.source}
              onSave={async (v) => {
                updateAssumption(key, Number(v));
              }}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          MRR & monthly expenses ({currency})
        </h2>
        <FinancialProjectionChart
          projections={financial.projections}
          currency={currency}
        />
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Monthly detail</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2">MRR ({currency})</th>
                <th className="px-4 py-2">Expenses</th>
                <th className="px-4 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {financial.projections.map((p) => (
                <tr key={p.month} className="border-t border-slate-50">
                  <td className="px-4 py-2">{p.month}</td>
                  <td className="px-4 py-2">{money(p.revenue)}</td>
                  <td className="px-4 py-2">{money(p.expenses ?? p.investment)}</td>
                  <td className="px-4 py-2">
                    {money(p.netMrr ?? p.revenue - (p.expenses ?? p.investment))}
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
