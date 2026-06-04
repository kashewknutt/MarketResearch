"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import { GeminiFallback } from "@/components/gemini-fallback";
import type { LeadRecord } from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

const col = createColumnHelper<LeadRecord>();

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [selected, setSelected] = useState<LeadRecord | null>(null);
  const load = useCallback(() => {
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => setLeads(d.leads ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAppRefresh(load, ["leads", "all"]);

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
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">
          Companies likely to need your services — scored with traceable sources. Use
          Refresh in the top bar to re-run lead discovery.
        </p>
      </header>

      {leads.length === 0 && (
        <GeminiFallback title="Run research or refresh to discover leads" verify />
      )}

      <DataTable
        data={leads}
        columns={columns}
        onRowClick={(row) => setSelected(row)}
      />

      <LeadDetailSheet lead={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
