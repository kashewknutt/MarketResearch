"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { AdIdeaDetailSheet } from "@/components/ad-idea-detail-sheet";
import type { AdTrendsSnapshot } from "@/lib/types/domain";
import type { Assignment, AssignmentStatus } from "@/lib/store/assignments";

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  done: "Done",
};

const ENTITY_LABELS: Record<Assignment["entityType"], string> = {
  ad_idea: "Ad idea",
  project: "Project",
  lead: "Lead",
  financial: "Financial",
  marketing: "Marketing",
  strategy: "Strategy",
  investment: "Investment",
  freeform: "Task",
};

const PAGE_LINKS: Partial<Record<Assignment["entityType"], string>> = {
  financial: "/financial-analysis",
  marketing: "/marketing",
  strategy: "/strategy",
  investment: "/investment-planner",
};

export default function TasksPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [ads, setAds] = useState<AdTrendsSnapshot | null>(null);
  const [openAdIdeaId, setOpenAdIdeaId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/assignments")
      .then((r) => r.json())
      .then((d) => setItems(d.assignments ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAppRefresh(load, ["all"]);

  const updateStatus = async (id: string, status: AssignmentStatus) => {
    const res = await fetch(`/api/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.assignment) {
      setItems((list) => list.map((a) => (a.id === id ? data.assignment : a)));
    }
  };

  const openAdIdea = async (entityId: string) => {
    if (!ads) {
      const res = await fetch("/api/ads");
      const data = await res.json();
      setAds(data.ads ?? null);
    }
    setOpenAdIdeaId(entityId);
  };

  const openIdea = ads?.ideasForYou.find((i) => i.id === openAdIdeaId) ?? null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">
          Work assigned to you across the workspace.
        </p>
      </header>

      {items.length === 0 && (
        <p className="rounded-xl border border-slate-100 bg-white p-6 text-sm text-slate-500">
          Nothing assigned to you yet.
        </p>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                  {ENTITY_LABELS[item.entityType]}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {STATUS_LABELS[item.status]}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-medium text-slate-800">{item.title}</p>
              {item.notes && (
                <p className="mt-0.5 text-xs text-slate-500">{item.notes}</p>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <select
                value={item.status}
                onChange={(e) =>
                  updateStatus(item.id, e.target.value as AssignmentStatus)
                }
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
              >
                <option value="assigned">Assigned</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>

              {item.entityType === "ad_idea" && item.entityId && (
                <button
                  type="button"
                  onClick={() => openAdIdea(item.entityId!)}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                >
                  Open
                </button>
              )}

              {item.entityType === "project" && item.entityId && (
                <Link
                  href={`/projects?focus=${item.entityId}`}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                >
                  Open
                </Link>
              )}

              {item.entityType === "lead" && item.entityId && (
                <Link
                  href={`/leads?focus=${item.entityId}`}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                >
                  Open
                </Link>
              )}

              {PAGE_LINKS[item.entityType] && (
                <Link
                  href={PAGE_LINKS[item.entityType]!}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Open page
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <AdIdeaDetailSheet
        idea={openIdea}
        onClose={() => setOpenAdIdeaId(null)}
        onIdeaUpdated={(updated) => setAds(updated)}
        contentPresets={ads?.contentPresets ?? []}
      />
    </div>
  );
}
