"use client";

import { formatMoney } from "@/lib/currency";
import type { MonthlyIncomeRow } from "@/lib/types/domain";

export function MonthlyIncomeTable({
  rows,
  currency,
  onChange,
}: {
  rows: MonthlyIncomeRow[];
  currency: string;
  onChange: (rows: MonthlyIncomeRow[]) => void;
}) {
  const patch = (month: number, field: keyof MonthlyIncomeRow, value: number) => {
    onChange(
      rows.map((r) =>
        r.month === month ? { ...r, [field]: value, userEdited: true } : r,
      ),
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-2 py-2">Mo</th>
            <th className="px-2 py-2">Low clients</th>
            <th className="px-2 py-2">Low MRR add</th>
            <th className="px-2 py-2">High-ticket cash</th>
            <th className="px-2 py-2">Whale cash</th>
            <th className="px-2 py-2">Cash in</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const cashIn = r.lowTicketMrr + r.highTicketCash + r.whaleCash;
            return (
              <tr key={r.month} className="border-t border-slate-50">
                <td className="px-2 py-1.5 font-medium">M{r.month}</td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    value={r.lowTicketClients}
                    onChange={(e) =>
                      patch(r.month, "lowTicketClients", Number(e.target.value))
                    }
                    className="w-14 rounded border border-slate-200 px-1 py-0.5"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    value={r.lowTicketMrr}
                    onChange={(e) =>
                      patch(r.month, "lowTicketMrr", Number(e.target.value))
                    }
                    className="w-20 rounded border border-slate-200 px-1 py-0.5"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    value={r.highTicketCash}
                    onChange={(e) =>
                      patch(r.month, "highTicketCash", Number(e.target.value))
                    }
                    className="w-20 rounded border border-slate-200 px-1 py-0.5"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    value={r.whaleCash}
                    onChange={(e) =>
                      patch(r.month, "whaleCash", Number(e.target.value))
                    }
                    className="w-20 rounded border border-slate-200 px-1 py-0.5"
                  />
                </td>
                <td className="px-2 py-1.5 text-slate-600">
                  {formatMoney(cashIn, currency)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
