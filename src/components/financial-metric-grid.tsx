"use client";

import { useMemo } from "react";
import { formatMoney } from "@/lib/currency";
import { newId } from "@/lib/id";
import { computePlMonth } from "@/lib/research/financial-pl-engine";
import type {
  FinancialMetricDefinition,
  FinancialMetricKind,
  FinancialMetricWorkbook,
  FinancialScenario,
} from "@/lib/types/domain";

const SUMMARY_ROWS = [
  { id: "_total_revenue", label: "Total Revenue", key: "totalRevenue" as const },
  { id: "_total_expenses", label: "Total Expenses", key: "totalExpenses" as const },
  { id: "_ebitda", label: "EBITDA", key: "ebitda" as const },
  { id: "_net_profit", label: "Net Profit", key: "netProfit" as const },
  {
    id: "_margin",
    label: "Profit Margin %",
    key: "profitMarginPct" as const,
    pct: true,
  },
];

export function FinancialMetricGrid({
  workbook,
  editScenario,
  currency,
  months,
  onChange,
}: {
  workbook: FinancialMetricWorkbook;
  editScenario: FinancialScenario;
  currency: string;
  months: number;
  onChange: (workbook: FinancialMetricWorkbook) => void;
}) {
  const values = workbook[editScenario];
  const sortedMetrics = useMemo(
    () => [...workbook.metrics].sort((a, b) => a.order - b.order),
    [workbook.metrics],
  );

  const columnSummaries = useMemo(() => {
    return Array.from({ length: months }, (_, i) =>
      computePlMonth(workbook.metrics, values, i),
    );
  }, [workbook.metrics, values, months]);

  const updateCell = (metricId: string, monthIndex: number, amount: number) => {
    const next = { ...values };
    const row = [...(next[metricId] ?? Array(months).fill(0))];
    row[monthIndex] = amount;
    next[metricId] = row;
    onChange({
      ...workbook,
      [editScenario]: next,
    });
  };

  const addMetric = (kind: FinancialMetricKind) => {
    const def: FinancialMetricDefinition = {
      id: newId(),
      label: kind === "revenue" ? "New revenue line" : "New expense line",
      kind,
      order: (workbook.metrics.length + 1) * 10,
      userDefined: true,
      recurring: kind === "revenue",
    };
    const empty = Array.from({ length: months }, () => 0);
    onChange({
      ...workbook,
      metrics: [...workbook.metrics, def],
      [editScenario]: { ...values, [def.id]: empty },
    });
  };

  const removeMetric = (id: string) => {
    const nextMetrics = workbook.metrics.filter((m) => m.id !== id);
    const nextCons = { ...workbook.conservative };
    const nextAmb = { ...workbook.ambitious };
    delete nextCons[id];
    delete nextAmb[id];
    onChange({
      ...workbook,
      metrics: nextMetrics,
      conservative: nextCons,
      ambitious: nextAmb,
    });
  };

  const fmt = (n: number, pct?: boolean) =>
    pct ? `${(n * 100).toFixed(1)}%` : formatMoney(n, currency);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => addMetric("revenue")}
          className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
        >
          + Revenue row
        </button>
        <button
          type="button"
          onClick={() => addMetric("expense")}
          className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-800"
        >
          + Expense row
        </button>
      </div>
      <div className="max-h-[480px] overflow-auto rounded-xl border border-slate-100">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
            <tr>
              <th className="sticky left-0 z-20 min-w-[180px] bg-slate-50 px-3 py-2">
                Metric
              </th>
              {Array.from({ length: months }, (_, i) => (
                <th key={i} className="min-w-[88px] px-2 py-2 text-right">
                  M{i + 1}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sortedMetrics.map((m) => (
              <tr
                key={m.id}
                className={
                  m.kind === "revenue"
                    ? "border-t border-emerald-50/80 bg-emerald-50/20"
                    : "border-t border-slate-50"
                }
              >
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-slate-700">
                  {m.label}
                  {m.recurring && (
                    <span className="ml-1 text-[10px] text-violet-500">recurring</span>
                  )}
                </td>
                {Array.from({ length: months }, (_, i) => (
                  <td key={i} className="px-1 py-1">
                    <input
                      type="number"
                      value={values[m.id]?.[i] ?? 0}
                      onChange={(e) =>
                        updateCell(m.id, i, Number(e.target.value))
                      }
                      className="w-full rounded border border-slate-200 px-1 py-0.5 text-right"
                    />
                  </td>
                ))}
                <td className="px-1">
                  {m.userDefined && (
                    <button
                      type="button"
                      onClick={() => removeMetric(m.id)}
                      className="text-slate-400 hover:text-rose-600"
                      title="Remove row"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {SUMMARY_ROWS.map((sr) => (
              <tr
                key={sr.id}
                className="border-t-2 border-slate-200 bg-slate-50/80 font-semibold"
              >
                <td className="sticky left-0 bg-slate-50 px-3 py-2 text-slate-800">
                  {sr.label}
                </td>
                {columnSummaries.map((col, i) => (
                  <td
                    key={i}
                    className={`px-2 py-2 text-right ${
                      sr.key === "netProfit" || sr.key === "ebitda"
                        ? col[sr.key] < 0
                          ? "text-rose-700"
                          : "text-emerald-700"
                        : "text-slate-800"
                    }`}
                  >
                    {fmt(col[sr.key], sr.pct)}
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
