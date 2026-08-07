"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import { NewLeadForm } from "@/components/new-lead-form";
import { ColdCallLeadsForm } from "@/components/cold-call-leads-form";
import { ExportLeadsForm } from "@/components/export-leads-form";
import { LikeCell } from "@/components/like-cell";
import { PageLoading } from "@/components/ui/page-loading";
import { useLikeSummaries } from "@/lib/hooks/use-like-summaries";
import type { ContactStatus, LeadRecord, LeadSource } from "@/lib/types/domain";
import {
  PROJECT_LEAD_CATEGORY_COLORS,
  PROJECT_LEAD_CATEGORY_LABELS,
} from "@/lib/project-lead-labels";
import type { ColumnDef } from "@tanstack/react-table";

const col = createColumnHelper<LeadRecord>();

type SourceFilter = "all" | LeadSource;

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

const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  not_contacted: "Not contacted",
  waiting_for_reply: "Waiting for reply",
  in_contact: "In contact",
  rejected: "Rejected",
};

const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  not_contacted: "bg-slate-50 text-slate-600",
  waiting_for_reply: "bg-amber-50 text-amber-700",
  in_contact: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
};

function ContactStatusBadge({ status }: { status: LeadRecord["contactStatus"] }) {
  const key = status ?? "not_contacted";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${CONTACT_STATUS_COLORS[key]}`}>
      {CONTACT_STATUS_LABELS[key]}
    </span>
  );
}

function SourceBadge({ lead }: { lead: LeadRecord }) {
  const source = lead.source ?? "discovery";
  if (source === "project") {
    return (
      <div className="space-y-1">
        <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
          Project
        </span>
        {lead.projectLeadCategory && (
          <span
            className={`block w-fit rounded-full px-2 py-0.5 text-[10px] ${PROJECT_LEAD_CATEGORY_COLORS[lead.projectLeadCategory]}`}
          >
            {PROJECT_LEAD_CATEGORY_LABELS[lead.projectLeadCategory]}
          </span>
        )}
      </div>
    );
  }
  if (source === "cold_call") {
    return (
      <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
        Cold call
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
      Discovery
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const projectId = searchParams.get("project");
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<LeadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [projectTitle, setProjectTitle] = useState<string | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showColdCall, setShowColdCall] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [profileRegions, setProfileRegions] = useState<string[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    const url = projectId
      ? `/api/leads?projectId=${encodeURIComponent(projectId)}`
      : `/api/leads?offset=0&limit=${PAGE_SIZE}${sourceFilter !== "all" ? `&source=${sourceFilter}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setLeads(d.leads ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [projectId, sourceFilter]);

  const loadMore = useCallback(() => {
    if (projectId) return;
    setLoadingMore(true);
    const url = `/api/leads?offset=${leads.length}&limit=${PAGE_SIZE}${sourceFilter !== "all" ? `&source=${sourceFilter}` : ""}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        setLeads((prev) => [...prev, ...(d.leads ?? [])]);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoadingMore(false));
  }, [leads.length, projectId, sourceFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setProfileRegions(d?.profile?.regions ?? []))
      .catch(() => setProfileRegions([]));
  }, []);

  useEffect(() => {
    if (projectId) {
      setSourceFilter("project");
      fetch(`/api/projects?id=${encodeURIComponent(projectId)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setProjectTitle(d?.project?.title ?? null))
        .catch(() => setProjectTitle(null));
      return;
    }
    setProjectTitle(null);
  }, [projectId]);

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

  // Source filtering happens server-side (via `source` on /api/leads) so pagination and
  // `total` stay accurate per tab; only the projectId scoping (a separate fetch branch) is
  // still applied client-side here since getLeadsByProjectId already returns the full set.
  const filteredLeads = useMemo(() => {
    if (!projectId) return leads;
    return leads.filter((l) => l.projectId === projectId);
  }, [leads, projectId]);

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
        col.display({
          id: "source",
          header: "Source",
          cell: ({ row }) => <SourceBadge lead={row.original} />,
        }),
        col.accessor("status", { header: "Status" }),
        col.display({
          id: "outreach",
          header: "Outreach",
          cell: ({ row }) => <OutreachBadge status={row.original.outreachStatus} />,
        }),
        col.display({
          id: "contactStatus",
          header: "Contact status",
          cell: ({ row }) => <ContactStatusBadge status={row.original.contactStatus} />,
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Leads</h1>
            <p className="mt-1 text-sm text-slate-500">
              Companies likely to need your services — scored with traceable sources. Use
              Refresh in the top bar to re-run lead discovery, or generate project-linked leads
              from a project.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setShowColdCall(true)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
            >
              Find cold-call leads
            </button>
            <button
              type="button"
              onClick={() => setShowNewLead(true)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              New lead
            </button>
            <button
              type="button"
              onClick={() => setShowExport(true)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["discovery", "Discovery"],
              ["project", "Project-linked"],
              ["cold_call", "Cold call"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setSourceFilter(value);
                if (projectId) router.push("/leads");
              }}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                sourceFilter === value && !projectId
                  ? "bg-violet-600 text-white"
                  : projectId
                    ? "bg-slate-100 text-slate-400"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              disabled={Boolean(projectId)}
            >
              {label}
            </button>
          ))}
        </div>
        {projectId && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2 text-xs text-sky-900">
            <span>
              Showing leads for{" "}
              <strong>{projectTitle ?? "this project"}</strong> ({filteredLeads.length})
            </span>
            <button
              type="button"
              onClick={() => router.push("/leads")}
              className="rounded-full bg-white px-2 py-0.5 font-medium text-sky-800 hover:bg-sky-100"
            >
              Clear filter
            </button>
          </div>
        )}
      </header>

      {loading ? (
        <PageLoading label="Loading leads…" />
      ) : (
        <>
          {leads.length === 0 && (
            <p className="text-sm text-slate-500">
              {projectId
                ? "No leads linked to this project yet. Generate context & leads from the project."
                : "Run research or refresh to discover leads."}
            </p>
          )}

          <DataTable
            data={filteredLeads}
            columns={columns}
            onRowClick={(row) => setSelected(row)}
            isLiked={isLiked}
          />

          {!projectId && leads.length < total && (
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
      {showNewLead && (
        <NewLeadForm
          onClose={() => setShowNewLead(false)}
          onCreated={(lead) => {
            setLeads((list) => [lead, ...list]);
            setTotal((t) => t + 1);
            setShowNewLead(false);
            setSelected(lead);
          }}
        />
      )}
      {showColdCall && (
        <ColdCallLeadsForm
          regions={profileRegions}
          onClose={() => setShowColdCall(false)}
          onFetched={() => {
            // Leads are already saved server-side; switch to the Cold call tab so the count
            // reflects the server-paginated total for that source instead of guessing at a
            // local splice. Switching tabs re-triggers load() automatically (see the
            // useEffect below); if the tab was already "cold_call", setSourceFilter is a
            // no-op, so load() is called explicitly in that case instead.
            setShowColdCall(false);
            if (sourceFilter === "cold_call") {
              load();
            } else {
              setSourceFilter("cold_call");
            }
          }}
        />
      )}
      {showExport && (
        <ExportLeadsForm
          currentSourceFilter={sourceFilter}
          currentTotal={total}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
