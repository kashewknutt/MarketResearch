"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { CitationList } from "@/components/ui/citation-list";
import { GeminiFallback } from "@/components/gemini-fallback";
import type { LeadRecord } from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

const col = createColumnHelper<LeadRecord>();

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selected, setSelected] = useState<LeadRecord | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = () =>
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => setLeads(d.leads ?? []));

  useEffect(() => {
    void load();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await fetch("/api/leads", { method: "POST" });
    await load();
    setRefreshing(false);
  };

  const columns = [
    col.accessor("company", { header: "Company" }),
    col.accessor("region", { header: "Region" }),
    col.accessor("fitScore", { header: "Fit score" }),
    col.accessor("status", { header: "Status" }),
    col.display({
      id: "sources",
      header: "Sources",
      cell: ({ row }) => row.original.sources.length,
    }),
  ] as ColumnDef<LeadRecord>[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Leads</h1>
          <p className="mt-1 text-sm text-slate-500">
            Companies likely to need your services — scored with traceable sources.
          </p>
        </div>
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void refresh()}
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {refreshing ? "Finding leads…" : "Refresh leads"}
        </button>
      </header>

      {leads.length === 0 && (
        <GeminiFallback title="Run research or refresh to discover leads" verify />
      )}

      <DataTable
        data={leads}
        columns={columns}
        onRowClick={(row) => setSelected(row)}
      />

      {selected && (
        <div className="rounded-xl border border-slate-100 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-800">{selected.company}</h2>
          <p className="mt-2 text-sm text-slate-600">{selected.whyFit}</p>
          <p className="mt-2 text-xs text-slate-500">{selected.contactHints}</p>
          <ul className="mt-3 list-inside list-disc text-xs text-slate-600">
            {selected.signals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <CitationList citations={selected.sources} />
        </div>
      )}
    </div>
  );
}
