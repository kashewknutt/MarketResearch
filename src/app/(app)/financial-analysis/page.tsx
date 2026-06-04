"use client";

import { useEffect, useState } from "react";
import { EditableField } from "@/components/editable-field";
import { GeminiFallback } from "@/components/gemini-fallback";
import type { FinancialSnapshot } from "@/lib/types/domain";

export default function FinancialAnalysisPage() {
  const [financial, setFinancial] = useState<FinancialSnapshot | null>(null);

  const load = () =>
    fetch("/api/financial")
      .then((r) => r.json())
      .then((d) => setFinancial(d.financial));

  useEffect(() => {
    void load();
  }, []);

  const updateAssumption = async (key: string, value: number) => {
    if (!financial) return;
    await fetch("/api/financial", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        assumptions: { [key]: value },
      }),
    });
    await load();
  };

  if (!financial) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Financial Analysis</h1>
        <GeminiFallback title="Run research to generate financial analysis" verify />
        <p className="text-sm text-slate-500">
          No financial data yet. Configure Gemini in Settings and re-run research.
        </p>
      </div>
    );
  }

  const a = financial.assumptions;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Financial Analysis</h1>
        <p className="mt-1 text-sm text-slate-500">{financial.narrative}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Gap to goal" value={`$${financial.gapToGoal.toLocaleString()}`} />
        <StatCard label="Monthly pace needed" value={`$${financial.monthlyPaceRequired.toLocaleString()}`} />
        <StatCard label="Horizon" value={`${financial.projections.length} months`} />
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Editable assumptions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["closeRate", a.value.closeRate],
              ["leadVolume", a.value.leadVolume],
              ["leadToCallRate", a.value.leadToCallRate],
              ["callToCloseRate", a.value.callToCloseRate],
              ["marketingSpend", a.value.marketingSpend],
              ["averageTicketUs", a.value.averageTicketUs],
              ["averageTicketIndia", a.value.averageTicketIndia],
              ["retentionRate", a.value.retentionRate],
            ] as const
          ).map(([key, val]) => (
            <EditableField
              key={key}
              label={key}
              value={val}
              type="number"
              provenance={a.isUserEdited ? "user" : a.source}
              onSave={(v) => updateAssumption(key, Number(v))}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Revenue projection</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Month</th>
                <th className="px-4 py-2">Revenue</th>
                <th className="px-4 py-2">Cumulative</th>
                <th className="px-4 py-2">Investment</th>
              </tr>
            </thead>
            <tbody>
              {financial.projections.slice(0, 24).map((p) => (
                <tr key={p.month} className="border-t border-slate-50">
                  <td className="px-4 py-2">{p.month}</td>
                  <td className="px-4 py-2">${p.revenue.toLocaleString()}</td>
                  <td className="px-4 py-2">${p.cumulativeRevenue.toLocaleString()}</td>
                  <td className="px-4 py-2">${p.investment.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Investment by category</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(financial.investmentByCategory).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-rose-50/50 px-4 py-3 text-sm capitalize">
              <span className="text-slate-600">{k.replace(/([A-Z])/g, " $1")}</span>
              <span className="float-right font-medium text-slate-800">
                ${v.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Highest-leverage variables</h2>
        <ul className="list-inside list-disc text-sm text-slate-600">
          {financial.leverageVariables.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-violet-50/30 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}
