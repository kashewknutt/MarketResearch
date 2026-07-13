"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import { LikeCell } from "@/components/like-cell";
import { PageLoading } from "@/components/ui/page-loading";
import { useLikeSummaries } from "@/lib/hooks/use-like-summaries";
import type { LeadRecord } from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

const col = createColumnHelper<LeadRecord>();

const OUTREACH_LABELS: Record<NonNullable<LeadRecord["outreachStatus"]>, string> = {
  none: "Not started",
  contact_found: "Contact found",
  drafted: "Drafted",
  sent: "Sent",
};

function OutreachBadge({ status }: { status: LeadRecord["outreachStatus"] }) {
  const key = status ?? "none";
  return (
    <span className="inline-block rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
      {OUTREACH_LABELS[key]}
    </span>
  );
}

export default function LeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsPageInner />
    </Suspense>
  );
}

const PAGE_SIZE = 30;

function LeadsPageInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<LeadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/leads?offset=0&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(() => {
    setLoadingMore(true);
    fetch(`/api/leads?offset=${leads.length}&limit=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((d) => {
        setLeads((prev) => [...prev, ...(d.leads ?? [])]);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoadingMore(false));
  }, [leads.length]);

  useEffect(() => {
    load();
  }, [load]);

  useAppRefresh(load, ["leads", "all"]);

  useEffect(() => {
    if (!focusId) return;
    const alreadyLoaded = leads.find((l) => l.id === focusId);
    if (alreadyLoaded) {
      setSelected(alreadyLoaded);
      return;
    }
    fetch(`/api/leads/${focusId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.lead) setSelected(d.lead);
      });
  }, [focusId, leads]);

  const { likes, toggle, refresh } = useLikeSummaries(
    "lead",
    useMemo(() => leads.map((l) => l.id), [leads]),
  );

  const columns = useMemo(
    () =>
      [
        col.display({
          id: "liked",
          header: "Liked",
          cell: ({ row }) => (
            <LikeCell liked={likes[row.original.id]} onToggle={() => toggle(row.original.id)} />
          ),
        }),
        col.accessor("company", { header: "Company" }),
        col.accessor("region", { header: "Region" }),
        col.accessor("fitScore", { header: "Fit score" }),
        col.accessor("status", { header: "Status" }),
        col.display({
          id: "outreach",
          header: "Outreach",
          cell: ({ row }) => <OutreachBadge status={row.original.outreachStatus} />,
        }),
        col.display({
          id: "sources",
          header: "Sources",
          cell: ({ row }) => row.original.sources.length,
        }),
      ] as ColumnDef<LeadRecord>[],
    [likes, toggle],
  );

  const isLiked = useCallback((row: LeadRecord) => likes[row.id]?.likedByMe ?? false, [likes]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">
          Companies likely to need your services — scored with traceable sources. Use
          Refresh in the top bar to re-run lead discovery.
        </p>
      </header>

      {loading ? (
        <PageLoading label="Loading leads…" />
      ) : (
        <>
          {leads.length === 0 && (
            <p className="text-sm text-slate-500">Run research or refresh to discover leads.</p>
          )}

          <DataTable
            data={leads}
            columns={columns}
            onRowClick={(row) => setSelected(row)}
            isLiked={isLiked}
          />

          {leads.length < total && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-100 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : `Load more (${leads.length} of ${total})`}
              </button>
            </div>
          )}
        </>
      )}

      <LeadDetailSheet
        lead={selected}
        onClose={() => {
          setSelected(null);
          refresh();
        }}
      />
    </div>
  );
}
