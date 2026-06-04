"use client";

import { formatMoney } from "@/lib/currency";
import type { MonthlyExpenseRow } from "@/lib/types/domain";

export function MonthlyExpenseTable({
  rows,
  currency,
  onChange,
  onResetMonth,
}: {
  rows: MonthlyExpenseRow[];
  currency: string;
  onChange: (rows: MonthlyExpenseRow[]) => void;
  onResetMonth?: (month: number) => void;
}) {
  const update = (month: number, totalExpenses: number) => {
    onChange(
      rows.map((r) =>
        r.month === month
          ? { ...r, totalExpenses, userEdited: true }
          : r,
      ),
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2">Month</th>
            <th className="px-3 py-2">Total expenses ({currency})</th>
            <th className="px-3 py-2 w-20" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-t border-slate-50">
              <td className="px-3 py-2 font-medium text-slate-700">M{r.month}</td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  value={r.totalExpenses}
                  onChange={(e) => update(r.month, Number(e.target.value))}
                  className="w-full max-w-[140px] rounded border border-slate-200 px-2 py-1"
                />
                <span className="ml-2 text-slate-400">
                  {formatMoney(r.totalExpenses, currency)}
                </span>
              </td>
              <td className="px-3 py-2">
                {onResetMonth && (
                  <button
                    type="button"
                    onClick={() => onResetMonth(r.month)}
                    className="text-slate-500 hover:text-violet-600"
                  >
                    Reset
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
