"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import { LikeCell } from "@/components/like-cell";
import { useLikeSummaries } from "@/lib/hooks/use-like-summaries";
import type { LeadRecord } from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

const col = createColumnHelper<LeadRecord>();

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsPageInner />
    </Suspense>
  );
}

function LeadsPageInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
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

  useEffect(() => {
    if (!focusId || leads.length === 0) return;
    const match = leads.find((l) => l.id === focusId);
    if (match) setSelected(match);
  }, [focusId, leads]);

  const { likes, toggle } = useLikeSummaries(
    "lead",
    useMemo(() => leads.map((l) => l.id), [leads]),
  );

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
    col.display({
      id: "liked",
      header: "Liked",
      cell: ({ row }) => (
        <LikeCell liked={likes[row.original.id]} onToggle={() => toggle(row.original.id)} />
      ),
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
        <p className="text-sm text-slate-500">Run research or refresh to discover leads.</p>
      )}

      <DataTable
        data={leads}
        columns={columns}
        onRowClick={(row) => setSelected(row)}
        isLiked={(row) => likes[row.id]?.likedByMe ?? false}
      />

      <LeadDetailSheet lead={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
