"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { FinancialMetricGrid } from "@/components/financial-metric-grid";
import {
  FinancialInflowOutflowChart,
  FinancialMrrChart,
} from "@/components/financial-projection-chart";
import { GeminiFallback } from "@/components/gemini-fallback";
import { MetricCard } from "@/components/ui/metric-card";
import { formatMoney } from "@/lib/currency";
import { computePlBothScenarios } from "@/lib/research/financial-pl-engine";
import { buildProjections } from "@/lib/research/projection-engine";
import type {
  FinancialAssumptions,
  FinancialMetricWorkbook,
  FinancialScenario,
  FinancialSnapshot,
  OnboardingProfile,
} from "@/lib/types/domain";

export default function FinancialAnalysisPage() {
  const [stored, setStored] = useState<FinancialSnapshot | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [assumptions, setAssumptions] = useState<FinancialAssumptions | null>(null);
  const [metricWorkbook, setMetricWorkbook] = useState<FinancialMetricWorkbook | null>(
    null,
  );
  const [editTab, setEditTab] = useState<FinancialScenario>("ambitious");

  const loadFinancial = useCallback(() => {
    fetch("/api/financial")
      .then((r) => r.json())
      .then((d) => {
        setStored(d.financial);
        setProfile(d.profile ?? null);
        if (d.financial?.assumptions?.value) {
          setAssumptions(d.financial.assumptions.value);
        }
        if (d.financial?.metricWorkbook) {
          setMetricWorkbook(d.financial.metricWorkbook);
          setEditTab(d.financial.metricWorkbook.activeScenario);
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
      metricWorkbook ?? undefined,
      stored?.monthlyPlans,
    );
  }, [profile, assumptions, stored, metricWorkbook]);

  const scenarioEnds = useMemo(() => {
    if (!profile || !financial?.metricWorkbook) return null;
    const { conservative, ambitious } = computePlBothScenarios(
      profile,
      financial.metricWorkbook,
    );
    return { conservative: conservative.finalMrr, ambitious: ambitious.finalMrr };
  }, [profile, financial?.metricWorkbook]);

  const updateWorkbook = useCallback((wb: FinancialMetricWorkbook) => {
    setMetricWorkbook(wb);
  }, []);

  const setActiveScenario = (scenario: FinancialScenario) => {
    if (!metricWorkbook) return;
    setMetricWorkbook({ ...metricWorkbook, activeScenario: scenario });
  };

  const persist = async () => {
    if (!assumptions || !metricWorkbook) return;
    await fetch("/api/financial", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assumptions, metricWorkbook }),
    });
    const res = await fetch("/api/financial");
    const d = await res.json();
    setStored(d.financial);
    if (d.financial?.metricWorkbook) setMetricWorkbook(d.financial.metricWorkbook);
  };

  if (!financial || !profile || !financial.metricWorkbook) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Financial Analysis</h1>
        <GeminiFallback title="Run research to generate financial analysis" verify />
      </div>
    );
  }

  const currency = profile.currency;
  const money = (n: number) => formatMoney(n, currency);
  const wb = metricWorkbook ?? financial.metricWorkbook!;
  const months = financial.projections.length;
  const last = financial.projections[financial.projections.length - 1];
  const lastSummary = last
    ? {
        revenue: last.totalRevenue ?? last.cashCollected ?? 0,
        expenses: last.totalExpenses ?? last.expenses,
        profit: last.netCash ?? last.netMrr ?? 0,
        margin: last.profitMarginPct ?? 0,
      }
    : null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Financial Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">{financial.narrative}</p>
        <p className="mt-2 text-xs text-slate-500">
          Domain-specific P&L: edit revenue and expense metrics per month (Conservative vs
          Ambitious). Total Revenue, EBITDA, Net Profit, and margin are computed automatically.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="End inflow (active)"
          value={money(lastSummary?.revenue ?? 0)}
          currency={currency}
        />
        <MetricCard
          label="End outflow (active)"
          value={money(lastSummary?.expenses ?? 0)}
          currency={currency}
        />
        <MetricCard
          label="End net profit"
          value={money(lastSummary?.profit ?? 0)}
          currency={currency}
        />
        <MetricCard
          label="End MRR"
          value={money(last?.recurringMrr ?? last?.revenue ?? 0)}
          currency={currency}
        />
      </div>

      {scenarioEnds && (
        <p className="text-xs text-slate-600">
          End MRR — Conservative: {money(scenarioEnds.conservative)} · Ambitious:{" "}
          {money(scenarioEnds.ambitious)} · Target: {money(profile.targetMrr)}
        </p>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-700">P&L metric grid</h2>
          <div className="flex rounded-lg border border-slate-200 p-0.5 text-xs">
            {(["conservative", "ambitious"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setEditTab(s)}
                className={`rounded-md px-3 py-1 capitalize ${
                  editTab === s
                    ? "bg-violet-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <FinancialMetricGrid
          workbook={wb}
          editScenario={editTab}
          currency={currency}
          months={months}
          onChange={updateWorkbook}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          Charts use active scenario
        </h2>
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          {(["conservative", "ambitious"] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 capitalize">
              <input
                type="radio"
                name="activeScenario"
                checked={wb.activeScenario === s}
                onChange={() => setActiveScenario(s)}
              />
              {s}
            </label>
          ))}
          <button
            type="button"
            onClick={() => void persist()}
            className="ml-auto rounded-lg bg-violet-500 px-4 py-1.5 text-xs text-white hover:bg-violet-600"
          >
            Save to database
          </button>
        </div>
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
            Inflow vs outflow ({wb.activeScenario})
          </h2>
          <FinancialInflowOutflowChart
            projections={financial.projections}
            currency={currency}
          />
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">MRR timeline</h2>
          <FinancialMrrChart
            projections={financial.projections}
            currency={currency}
            targetMrr={profile.targetMrr}
            scenarioLabel={`Active: ${wb.activeScenario}`}
          />
        </div>
      </section>
    </div>
  );
}
