"use client";

import type { DemandSignal } from "@/lib/types/domain";
import { EditableField } from "@/components/editable-field";

export function DemandList({
  demands,
  onUpdate,
}: {
  demands: DemandSignal[];
  onUpdate?: (id: string, field: string, value: string | number) => void;
}) {
  if (demands.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No demand data yet. Configure Gemini and run research from Settings.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {demands.map((d) => (
        <li
          key={d.id}
          className="rounded-xl border border-slate-100 bg-gradient-to-r from-white to-sky-50/30 p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-800">
              {d.rank}
            </span>
            {onUpdate ? (
              <EditableField
                label="Demand"
                value={d.title}
                provenance={d.provenance.source}
                onSave={async (v) => onUpdate(d.id, "title", v)}
              />
            ) : (
              <h3 className="text-sm font-semibold text-slate-800">{d.title}</h3>
            )}
          </div>
          <p className="text-xs text-slate-600">{d.description}</p>
          <p className="mt-2 text-xs font-medium text-slate-700">
            Ticket: {d.currency} {d.ticketSizeMin.toLocaleString()} –{" "}
            {d.ticketSizeMax.toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}
