"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  pageTitleFromPath,
  REFRESH_SECTION_LABELS,
  refreshSectionFromPath,
  type RefreshSection,
} from "@/lib/research/refresh-section-config";
import { emitAppDataRefreshed } from "@/lib/hooks/use-app-refresh";

export function AppTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const section = refreshSectionFromPath(pathname ?? "");
  const label = REFRESH_SECTION_LABELS[section];
  const title = pageTitleFromPath(pathname ?? "");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runRefresh = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      if (section === "api-costs") {
        const res = await fetch("/api/costs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "refresh_pricing" }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.message ?? "Failed to refresh pricing");
        }
        emitAppDataRefreshed(section);
        setRefreshing(false);
        return;
      }

      if (section === "sources") {
        emitAppDataRefreshed(section);
        setRefreshing(false);
        return;
      }

      const res = await fetch("/api/research/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message ?? "Refresh failed");
      }

      if (data.mode === "job" && data.jobId) {
        router.push(`/loading?jobId=${data.jobId}`);
        return;
      }

      emitAppDataRefreshed(
        (data.section as RefreshSection) ?? section,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [section, router]);

  return (
    <header className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-slate-100 bg-white/95 px-8 py-3 backdrop-blur">
      <h1 className="text-sm font-semibold text-slate-800">{title}</h1>
      <div className="flex items-center gap-3">
        {error && (
          <span className="max-w-xs truncate text-xs text-rose-600" title={error}>
            {error}
          </span>
        )}
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void runRefresh()}
          className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-800 transition-colors hover:bg-violet-100 disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : label}
        </button>
      </div>
    </header>
  );
}
