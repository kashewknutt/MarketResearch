"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/currency";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/research/expense-line-items";
import type { ExpenseCategory, MonthlyProjection } from "@/lib/types/domain";

function useChartReady(projectionsLength: number) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && projectionsLength > 0;
}

export function FinancialMrrChart({
  projections,
  currency,
  targetMrr,
  scenarioLabel,
}: {
  projections: MonthlyProjection[];
  currency: string;
  targetMrr?: number;
  scenarioLabel?: string;
}) {
  const ready = useChartReady(projections.length);
  const data = projections.map((p) => ({
    month: `M${p.month}`,
    mrr: p.recurringMrr ?? p.revenue,
  }));
  const fmt = (v: number) => formatMoney(v, currency);

  if (!ready) {
    return (
      <div className="flex h-64 min-h-[256px] min-w-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-400">
        Loading chart…
      </div>
    );
  }

  return (
    <div className="h-64 min-h-[256px] min-w-0 w-full rounded-xl border border-slate-100 bg-white p-4">
      {scenarioLabel && (
        <p className="mb-2 text-xs font-medium text-slate-600">{scenarioLabel}</p>
      )}
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(Number(v))} />
          <Tooltip formatter={(value) => fmt(Number(value ?? 0))} />
          {targetMrr != null && targetMrr > 0 && (
            <ReferenceLine
              y={targetMrr}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{ value: "Target MRR", fontSize: 10, fill: "#64748b" }}
            />
          )}
          <Line
            type="stepAfter"
            dataKey="mrr"
            name="Recurring MRR"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinancialInflowOutflowChart({
  projections,
  currency,
}: {
  projections: MonthlyProjection[];
  currency: string;
}) {
  const ready = useChartReady(projections.length);
  const data = projections.map((p) => ({
    month: `M${p.month}`,
    inflow: p.totalRevenue ?? p.cashCollected ?? p.revenue,
    outflow: p.totalExpenses ?? p.expenses ?? p.investment,
    netProfit:
      p.netCash ??
      p.netMrr ??
      (p.totalRevenue ?? p.cashCollected ?? 0) -
        (p.totalExpenses ?? p.expenses ?? p.investment),
  }));
  const fmt = (v: number) => formatMoney(v, currency);

  if (!ready) {
    return (
      <div className="flex h-64 min-h-[256px] min-w-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-400">
        Loading chart…
      </div>
    );
  }

  return (
    <div className="h-64 min-h-[256px] min-w-0 w-full rounded-xl border border-slate-100 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(Number(v))} />
          <Tooltip formatter={(value) => fmt(Number(value ?? 0))} />
          <Legend />
          <Bar dataKey="inflow" name="Inflow (revenue)" fill="#86efac" radius={[2, 2, 0, 0]} />
          <Bar dataKey="outflow" name="Outflow (expenses)" fill="#fda4af" radius={[2, 2, 0, 0]} />
          <Line
            type="monotone"
            dataKey="netProfit"
            name="Net profit"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinancialProfitChart({
  projections,
  currency,
}: {
  projections: MonthlyProjection[];
  currency: string;
}) {
  const ready = useChartReady(projections.length);
  const data = projections.map((p) => ({
    month: `M${p.month}`,
    profit:
      p.netCash ??
      p.netMrr ??
      (p.cashCollected ?? 0) - (p.expenses ?? p.investment),
    expenses: p.expenses ?? p.investment,
    cash: p.cashCollected ?? 0,
  }));
  const fmt = (v: number) => formatMoney(v, currency);

  if (!ready) {
    return (
      <div className="flex h-64 min-h-[256px] min-w-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-400">
        Loading chart…
      </div>
    );
  }

  return (
    <div className="h-64 min-h-[256px] min-w-0 w-full rounded-xl border border-slate-100 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(Number(v))} />
          <Tooltip formatter={(value) => fmt(Number(value ?? 0))} />
          <Bar dataKey="profit" name="Monthly profit" fill="#10b981" radius={[2, 2, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

const EXPENSE_CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  people: "#7c3aed",
  tools: "#0ea5e9",
  marketing: "#f59e0b",
  operations: "#10b981",
  other: "#94a3b8",
};

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "people",
  "tools",
  "marketing",
  "operations",
  "other",
];

export function FinancialExpenseBreakdownChart({
  projections,
  currency,
}: {
  projections: MonthlyProjection[];
  currency: string;
}) {
  const ready = useChartReady(projections.length);
  const data = projections.map((p) => {
    const row: Record<string, string | number> = { month: `M${p.month}` };
    for (const category of EXPENSE_CATEGORIES) {
      row[category] = p.expenseByCategory?.[category] ?? 0;
    }
    return row;
  });
  const fmt = (v: number) => formatMoney(v, currency);
  const hasBreakdown = projections.some((p) => p.expenseByCategory);

  if (!ready) {
    return (
      <div className="flex h-64 min-h-[256px] min-w-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-400">
        Loading chart…
      </div>
    );
  }

  if (!hasBreakdown) {
    return (
      <div className="flex h-64 min-h-[256px] min-w-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-400">
        No expense category breakdown available for this projection.
      </div>
    );
  }

  return (
    <div className="h-64 min-h-[256px] min-w-0 w-full rounded-xl border border-slate-100 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(Number(v))} />
          <Tooltip formatter={(value) => fmt(Number(value ?? 0))} />
          <Legend />
          {EXPENSE_CATEGORIES.map((category) => (
            <Bar
              key={category}
              dataKey={category}
              name={EXPENSE_CATEGORY_LABELS[category]}
              stackId="expenses"
              fill={EXPENSE_CATEGORY_COLORS[category]}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function FinancialBurnRunwayChart({
  projections,
  currency,
  cashOnHand,
}: {
  projections: MonthlyProjection[];
  currency: string;
  cashOnHand: number;
}) {
  const ready = useChartReady(projections.length);
  let balance = cashOnHand;
  const data = projections.map((p) => {
    const net =
      p.netCash ??
      p.netMrr ??
      (p.totalRevenue ?? p.cashCollected ?? 0) - (p.totalExpenses ?? p.expenses ?? p.investment);
    balance += net;
    return { month: `M${p.month}`, balance };
  });
  const fmt = (v: number) => formatMoney(v, currency);

  if (!ready) {
    return (
      <div className="flex h-64 min-h-[256px] min-w-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-4 text-sm text-slate-400">
        Loading chart…
      </div>
    );
  }

  return (
    <div className="h-64 min-h-[256px] min-w-0 w-full rounded-xl border border-slate-100 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(Number(v))} />
          <Tooltip formatter={(value) => fmt(Number(value ?? 0))} />
          <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="balance"
            name="Projected cash balance"
            stroke="#7c3aed"
            fill="#c4b5fd"
            fillOpacity={0.4}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** @deprecated Use FinancialMrrChart + FinancialProfitChart */
export function FinancialProjectionChart({
  projections,
  currency,
}: {
  projections: MonthlyProjection[];
  currency: string;
  showExpenseBreakdown?: boolean;
}) {
  return (
    <div className="space-y-4">
      <FinancialInflowOutflowChart projections={projections} currency={currency} />
      <FinancialMrrChart projections={projections} currency={currency} />
    </div>
  );
}
