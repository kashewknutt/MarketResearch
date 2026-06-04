"use client";

import { CitationList } from "@/components/ui/citation-list";
import type { LeadRecord } from "@/lib/types/domain";

interface LeadDetailSheetProps {
  lead: LeadRecord | null;
  onClose: () => void;
}

export function LeadDetailSheet({ lead, onClose }: LeadDetailSheetProps) {
  if (!lead) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">{lead.company}</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <span className="inline-block rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
          {lead.region} · Fit {lead.fitScore}
        </span>

        {(lead.whyPerfect || lead.whyFit) && (
          <section className="rounded-lg bg-violet-50/40 p-4">
            <p className="text-sm font-medium text-slate-800">Why this lead is perfect</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">
              {lead.whyPerfect || lead.whyFit}
            </p>
          </section>
        )}

        {lead.contactPlan && (
          <section>
            <p className="text-sm font-medium text-slate-800">How to contact</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{lead.contactPlan}</p>
            {lead.contactHints && (
              <p className="mt-2 text-xs text-slate-500">
                <strong className="text-slate-600">Hints:</strong> {lead.contactHints}
              </p>
            )}
          </section>
        )}

        {lead.pitchOutline && (
          <section>
            <p className="text-sm font-medium text-slate-800">What to pitch</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{lead.pitchOutline}</p>
          </section>
        )}

        {lead.signals.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Signals</p>
            <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
              {lead.signals.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        {lead.objections && lead.objections.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Likely objections</p>
            <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
              {lead.objections.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <p className="text-sm font-medium text-slate-800">Citations</p>
          <CitationList citations={lead.sources} />
        </section>
      </div>
    </div>
  );
}
