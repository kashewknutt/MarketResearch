"use client";

import { useCallback } from "react";
import {
  EXPENSE_CATEGORY_LABELS,
  newExpenseLineId,
} from "@/lib/research/expense-line-items";
import type { ExpenseCategory, ExpenseLineItem } from "@/lib/types/domain";

const CATEGORIES: ExpenseCategory[] = [
  "people",
  "tools",
  "marketing",
  "operations",
  "other",
];

export function ExpenseLineItemsEditor({
  items,
  currency,
  onChange,
}: {
  items: ExpenseLineItem[];
  currency: string;
  onChange: (items: ExpenseLineItem[]) => void;
}) {
  const update = useCallback(
    (id: string, patch: Partial<ExpenseLineItem>) => {
      onChange(
        items.map((i) =>
          i.id === id ? { ...i, ...patch, source: "user" as const } : i,
        ),
      );
    },
    [items, onChange],
  );

  const remove = (id: string) => {
    onChange(items.filter((i) => i.id !== id));
  };

  const add = () => {
    onChange([
      ...items,
      {
        id: newExpenseLineId(),
        name: "New expense",
        category: "other",
        monthlyAmount: 0,
        source: "user",
      },
    ]);
  };

  const monthlyTotal = items.reduce((s, i) => s + (Number(i.monthlyAmount) || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Monthly expense lines ({currency}) — edit amounts or add/remove rows; chart
          updates live.
        </p>
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs text-violet-700 hover:bg-violet-50"
        >
          Add line item
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Monthly ({currency})</th>
              <th className="px-3 py-2">Headcount</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-50">
                <td className="px-3 py-2">
                  <input
                    className="w-full min-w-[8rem] rounded border border-slate-200 px-2 py-1"
                    value={item.name}
                    onChange={(e) => update(item.id, { name: e.target.value })}
                  />
                  {item.source === "linkedin" && (
                    <span className="mt-0.5 block text-[10px] text-sky-600">
                      LinkedIn data
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <select
                    className="rounded border border-slate-200 px-2 py-1"
                    value={item.category}
                    onChange={(e) =>
                      update(item.id, { category: e.target.value as ExpenseCategory })
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {EXPENSE_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    className="w-28 rounded border border-slate-200 px-2 py-1"
                    value={item.monthlyAmount}
                    onChange={(e) =>
                      update(item.id, { monthlyAmount: Number(e.target.value) || 0 })
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    className="w-16 rounded border border-slate-200 px-2 py-1"
                    value={item.headcount ?? ""}
                    placeholder="—"
                    onChange={(e) => {
                      const v = e.target.value;
                      update(item.id, {
                        headcount: v === "" ? undefined : Number(v) || 0,
                      });
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    className="text-slate-400 hover:text-rose-600"
                    aria-label={`Remove ${item.name}`}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-100 bg-slate-50 font-medium text-slate-700">
            <tr>
              <td className="px-3 py-2" colSpan={2}>
                Total monthly
              </td>
              <td className="px-3 py-2" colSpan={3}>
                {monthlyTotal.toLocaleString()} {currency}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
