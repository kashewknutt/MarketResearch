"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";
import { LikeCell } from "@/components/like-cell";
import { useLikeSummaries } from "@/lib/hooks/use-like-summaries";
import { formatMoney } from "@/lib/currency";
import type { MarketProject } from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

const col = createColumnHelper<MarketProject>();

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageInner />
    </Suspense>
  );
}

function ProjectsPageInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");
  const [projects, setProjects] = useState<MarketProject[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<MarketProject | null>(null);

  const load = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects ?? []);
        setRegions(d.regions ?? []);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAppRefresh(load, ["projects", "all"]);

  useEffect(() => {
    if (!focusId || projects.length === 0) return;
    const match = projects.find((p) => p.id === focusId);
    if (match) setSelected(match);
  }, [focusId, projects]);

  const filtered =
    filter === "all" ? projects : projects.filter((p) => p.region === filter);

  const { likes, toggle, refresh } = useLikeSummaries(
    "project",
    useMemo(() => filtered.map((p) => p.id), [filtered]),
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
        col.accessor("title", { header: "Project", cell: (i) => i.getValue() }),
        col.accessor("region", { header: "Region" }),
        col.accessor("effort", { header: "Effort" }),
        col.accessor("ticketSize", {
          header: "Ticket",
          cell: ({ row }) =>
            formatMoney(row.original.ticketSize, row.original.currency),
        }),
        col.accessor("confidenceScore", {
          header: "Confidence",
          cell: (i) => {
            const v = i.getValue();
            return v != null ? `${Math.round(v * 100)}%` : "—";
          },
        }),
        col.display({
          id: "sources",
          header: "Sources",
          cell: ({ row }) => row.original.provenance.citations?.length ?? 0,
        }),
      ] as ColumnDef<MarketProject>[],
    [likes, toggle],
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Projects</h1>
        <p className="mt-1 text-sm text-slate-500">
          Evidence-backed opportunities per region. Click a row for full analysis.
        </p>
      </header>
      <div className="flex gap-2">
        <FilterBtn active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {regions.map((r) => (
          <FilterBtn key={r} active={filter === r} onClick={() => setFilter(r)} label={r} />
        ))}
      </div>
      <DataTable
        data={filtered}
        columns={columns}
        onRowClick={(row) => setSelected(row)}
        isLiked={(row) => likes[row.id]?.likedByMe ?? false}
      />
      <ProjectDetailSheet
        project={selected}
        onClose={() => {
          setSelected(null);
          refresh();
        }}
        onUpdated={(p) => {
          setProjects((list) => list.map((x) => (x.id === p.id ? p : x)));
          setSelected(p);
        }}
      />
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-violet-100 text-violet-800" : "bg-slate-50 text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
