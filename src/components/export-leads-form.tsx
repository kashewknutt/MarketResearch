"use client";

import { useEffect, useState } from "react";
import type { LeadSource } from "@/lib/types/domain";

interface ExportLeadsFormProps {
  currentSourceFilter: "all" | LeadSource;
  currentTotal: number;
  onClose: () => void;
}

type ColumnKey =
  | "company"
  | "region"
  | "source"
  | "status"
  | "contactStatus"
  | "contactRemarks"
  | "fitScore"
  | "companyPhone"
  | "companyAddress"
  | "companyWebsite"
  | "businessStatus"
  | "whyFit"
  | "painPoint"
  | "pitchOutline"
  | "contactHints"
  | "contactPlan"
  | "signals"
  | "outreachStatus"
  | "createdAt";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  company: "Company",
  region: "Region",
  source: "Source",
  status: "Status",
  contactStatus: "Contact status",
  contactRemarks: "Contact remarks",
  fitScore: "Fit score",
  companyPhone: "Phone",
  companyAddress: "Address",
  companyWebsite: "Website",
  businessStatus: "Business status",
  whyFit: "Why fit",
  painPoint: "Pain point",
  pitchOutline: "Pitch outline",
  contactHints: "Contact hints",
  contactPlan: "Contact plan",
  signals: "Signals",
  outreachStatus: "Outreach status",
  createdAt: "Created at",
};

const ALL_COLUMNS = Object.keys(COLUMN_LABELS) as ColumnKey[];

const DEFAULT_COLUMNS: ColumnKey[] = [
  "company",
  "companyPhone",
  "companyAddress",
  "region",
  "painPoint",
  "whyFit",
  "contactStatus",
  "source",
];

const SOURCE_OPTIONS: Array<{ value: "all" | LeadSource; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "discovery", label: "Discovery" },
  { value: "project", label: "Project-linked" },
  { value: "cold_call", label: "Cold call" },
];

export function ExportLeadsForm({ currentSourceFilter, currentTotal, onClose }: ExportLeadsFormProps) {
  const [source, setSource] = useState<"all" | LeadSource>(currentSourceFilter);
  const [rowCount, setRowCount] = useState(String(currentTotal || 100));
  const [selectedColumns, setSelectedColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS));
  const [countForSource, setCountForSource] = useState<number | null>(currentTotal || null);

  useEffect(() => {
    if (source === currentSourceFilter) {
      setCountForSource(currentTotal || null);
      setRowCount(String(currentTotal || 100));
      return;
    }
    const url = source === "all" ? "/api/leads?offset=0&limit=1" : `/api/leads?offset=0&limit=1&source=${source}`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const total = d.total ?? 0;
        setCountForSource(total);
        setRowCount(String(total || 100));
      })
      .catch(() => setCountForSource(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const toggleColumn = (key: ColumnKey) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const numericRowCount = Number(rowCount);
  const canExport = selectedColumns.size > 0 && Number.isFinite(numericRowCount) && numericRowCount >= 1;

  const exportUrl = () => {
    const params = new URLSearchParams();
    params.set("columns", Array.from(selectedColumns).join(","));
    params.set("limit", String(Math.floor(numericRowCount)));
    if (source !== "all") params.set("source", source);
    return `/api/leads/export?${params.toString()}`;
  };

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-end bg-black/20">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Export leads to CSV</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Choose which leads and which columns to include in the export.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-500">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as "all" | LeadSource)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">
              Number of rows{countForSource != null ? ` (${countForSource} available)` : ""}
            </label>
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={rowCount}
              onChange={(e) => setRowCount(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Columns</label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {ALL_COLUMNS.map((key) => (
                <label key={key} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={selectedColumns.has(key)}
                    onChange={() => toggleColumn(key)}
                    className="rounded border-slate-300"
                  />
                  {COLUMN_LABELS[key]}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <a
            href={canExport ? exportUrl() : undefined}
            onClick={(e) => {
              if (!canExport) e.preventDefault();
              else onClose();
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm ${
              canExport ? "bg-violet-600 hover:bg-violet-700" : "cursor-not-allowed bg-violet-300"
            }`}
          >
            Export CSV
          </a>
        </div>
      </div>
    </div>
  );
}
