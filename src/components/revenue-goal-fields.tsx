"use client";

import {
  CURRENCY_PRESETS,
  CURRENT_MRR_HELP,
  GOAL_HORIZON_HELP,
  TARGET_MRR_HELP,
  isPresetCurrency,
  normalizeCurrency,
} from "@/lib/currency";

const CUSTOM_CURRENCY = "__custom__";

export interface RevenueGoalValues {
  currency: string;
  currentMrr: number;
  targetMrr: number;
  goalMonths: number;
}

interface RevenueGoalFieldsProps {
  values: RevenueGoalValues;
  onChange: (values: RevenueGoalValues) => void;
  showHorizon?: boolean;
}

export function RevenueGoalFields({
  values,
  onChange,
  showHorizon = true,
}: RevenueGoalFieldsProps) {
  const currency = normalizeCurrency(values.currency);
  const selectValue = isPresetCurrency(currency) ? currency : CUSTOM_CURRENCY;
  const customCurrency = selectValue === CUSTOM_CURRENCY ? currency : "";

  const patch = (partial: Partial<RevenueGoalValues>) =>
    onChange({ ...values, ...partial });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-slate-500">Reporting currency</label>
        <select
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={selectValue}
          onChange={(e) => {
            const next = e.target.value;
            if (next === CUSTOM_CURRENCY) {
              patch({ currency: customCurrency || "USD" });
            } else {
              patch({ currency: next });
            }
          }}
        >
          {CURRENCY_PRESETS.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.label}
            </option>
          ))}
          <option value={CUSTOM_CURRENCY}>Custom ISO code…</option>
        </select>
        {selectValue === CUSTOM_CURRENCY && (
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase"
            value={customCurrency}
            maxLength={3}
            placeholder="e.g. NOK"
            onChange={(e) => patch({ currency: normalizeCurrency(e.target.value) })}
          />
        )}
        <p className="mt-1 text-xs text-slate-400">
          Used for MRR targets and financial projections in this app.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">
          Current MRR ({currency})
        </label>
        <input
          type="number"
          min={0}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={values.currentMrr}
          onChange={(e) => patch({ currentMrr: Number(e.target.value) })}
        />
        <p className="mt-1 text-xs text-slate-400">{CURRENT_MRR_HELP}</p>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">
          Target MRR ({currency})
        </label>
        <input
          type="number"
          min={0}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={values.targetMrr}
          onChange={(e) => patch({ targetMrr: Number(e.target.value) })}
        />
        <p className="mt-1 text-xs text-slate-400">{TARGET_MRR_HELP}</p>
      </div>

      {showHorizon && (
        <div>
          <label className="text-xs font-medium text-slate-500">
            Time to reach target MRR: {values.goalMonths} months (max 50)
          </label>
          <input
            type="range"
            min={1}
            max={50}
            value={values.goalMonths}
            onChange={(e) => patch({ goalMonths: Number(e.target.value) })}
            className="mt-2 w-full"
          />
          <p className="mt-1 text-xs text-slate-400">{GOAL_HORIZON_HELP}</p>
        </div>
      )}
    </div>
  );
}
