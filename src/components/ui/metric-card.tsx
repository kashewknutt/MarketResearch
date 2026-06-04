export function MetricCard({
  label,
  value,
  currency,
  hint,
}: {
  label: string;
  value: string;
  currency?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-violet-50/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">{label}</p>
        {currency && (
          <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
            {currency}
          </span>
        )}
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
}
