"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/currency";
import type { MonthlyProjection } from "@/lib/types/domain";

export function FinancialProjectionChart({
  projections,
  currency,
  showExpenseBreakdown = true,
}: {
  projections: MonthlyProjection[];
  currency: string;
  showExpenseBreakdown?: boolean;
}) {
  const hasBreakdown = projections.some((p) => p.expenseByCategory);
  const data = projections.map((p) => ({
    month: `M${p.month}`,
    mrr: p.revenue,
    expenses: p.expenses ?? p.investment,
    net: p.netMrr ?? p.revenue - (p.expenses ?? p.investment),
    people: p.expenseByCategory?.people ?? 0,
    tools: p.expenseByCategory?.tools ?? 0,
    marketing: p.expenseByCategory?.marketing ?? 0,
    operations: p.expenseByCategory?.operations ?? 0,
    other: p.expenseByCategory?.other ?? 0,
  }));

  const fmt = (v: number) => formatMoney(v, currency);

  return (
    <div className="h-80 w-full rounded-xl border border-slate-100 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(Number(v))} />
          <Tooltip
            formatter={(value) => fmt(Number(value ?? 0))}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend />
          {showExpenseBreakdown && hasBreakdown ? (
            <>
              <Bar dataKey="people" stackId="exp" name="People" fill="#a78bfa" />
              <Bar dataKey="tools" stackId="exp" name="Tools" fill="#67e8f9" />
              <Bar dataKey="marketing" stackId="exp" name="Marketing" fill="#fda4af" />
              <Bar dataKey="operations" stackId="exp" name="Operations" fill="#fcd34d" />
              <Bar dataKey="other" stackId="exp" name="Other" fill="#cbd5e1" />
            </>
          ) : (
            <Bar
              dataKey="expenses"
              name="Monthly expenses"
              fill="#fda4af"
              radius={[2, 2, 0, 0]}
            />
          )}
          <Line
            type="monotone"
            dataKey="mrr"
            name="Planned MRR"
            stroke="#7c3aed"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="net"
            name="MRR − expenses"
            stroke="#0ea5e9"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
