"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { AdIdeaDetailSheet, TrendingAdDetailSheet } from "@/components/ad-idea-detail-sheet";
import { LikeButton } from "@/components/like-button";
import { ProjectDetailSheet } from "@/components/project-detail-sheet";
import { LeadDetailSheet } from "@/components/lead-detail-sheet";
import { CampaignDetailSheet } from "@/components/campaign-detail-sheet";
import type {
  AdTrendsSnapshot,
  LeadRecord,
  MarketingItem,
  MarketingSnapshot,
  MarketProject,
  TrendingAdExample,
} from "@/lib/types/domain";
import type { Assignment, AssignmentEntityType, AssignmentStatus } from "@/lib/store/assignments";

const STATUS_LABELS: Record<AssignmentStatus, string> = {
  assigned: "Assigned",
  in_progress: "In progress",
  done: "Done",
};

const ENTITY_LABELS: Record<AssignmentEntityType, string> = {
  ad_idea: "Ad idea",
  trending_ad: "Trending ad",
  project: "Project",
  lead: "Lead",
  financial: "Financial",
  marketing: "Marketing",
  strategy: "Strategy",
  investment: "Investment",
  freeform: "Task",
};

const PAGE_LINKS: Partial<Record<AssignmentEntityType, string>> = {
  financial: "/financial-analysis",
  marketing: "/marketing",
  strategy: "/strategy",
  investment: "/investment-planner",
};

function findMarketingItem(marketing: MarketingSnapshot | null, id: string): MarketingItem | null {
  if (!marketing) return null;
  const all = [
    ...marketing.contentThemes,
    ...marketing.offers,
    ...marketing.channels,
    ...marketing.proofAssets,
  ];
  return all.find((item) => item.id === id) ?? null;
}

function findTrendingExample(ads: AdTrendsSnapshot | null, id: string): TrendingAdExample | null {
  if (!ads) return null;
  const fromTrending = ads.trendingNow.find((e) => e.id === id);
  if (fromTrending) return fromTrending;
  for (const c of ads.competitorActivity) {
    const match = c.examples.find((e) => e.id === id);
    if (match) return match;
  }
  return null;
}

export default function TasksPage() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [ads, setAds] = useState<AdTrendsSnapshot | null>(null);
  const [projects, setProjects] = useState<MarketProject[]>([]);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [marketing, setMarketing] = useState<MarketingSnapshot | null>(null);
  const [currency, setCurrency] = useState("USD");

  const [openAdIdeaId, setOpenAdIdeaId] = useState<string | null>(null);
  const [openTrendingId, setOpenTrendingId] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [openMarketingId, setOpenMarketingId] = useState<string | null>(null);

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

  const openTrendingAd = async (entityId: string) => {
    if (!ads) {
      const res = await fetch("/api/ads");
      const data = await res.json();
      setAds(data.ads ?? null);
    }
    setOpenTrendingId(entityId);
  };

  const openProject = async (entityId: string) => {
    if (projects.length === 0) {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(data.projects ?? []);
    }
    setOpenProjectId(entityId);
  };

  const openLead = async (entityId: string) => {
    if (leads.length === 0) {
      const res = await fetch("/api/leads");
      const data = await res.json();
      setLeads(data.leads ?? []);
    }
    setOpenLeadId(entityId);
  };

  const openMarketingItem = async (entityId: string) => {
    let current = marketing;
    if (!current) {
      const [marketingRes, profileRes] = await Promise.all([
        fetch("/api/marketing"),
        fetch("/api/profile"),
      ]);
      const marketingData = await marketingRes.json();
      const profileData = await profileRes.json();
      current = marketingData.marketing ?? null;
      setMarketing(current);
      setCurrency(profileData.profile?.currency ?? "USD");
    }
    setOpenMarketingId(entityId);
  };

  const openIdea = ads?.ideasForYou.find((i) => i.id === openAdIdeaId) ?? null;
  const openTrending = openTrendingId ? findTrendingExample(ads, openTrendingId) : null;
  const openProjectItem = projects.find((p) => p.id === openProjectId) ?? null;
  const openLeadItem = leads.find((l) => l.id === openLeadId) ?? null;
  const openMarketingItemResolved = openMarketingId ? findMarketingItem(marketing, openMarketingId) : null;

  const openAction = (item: Assignment) => {
    if (!item.entityId) return null;

    if (item.entityType === "ad_idea") {
      return (
        <button
          type="button"
          onClick={() => openAdIdea(item.entityId!)}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
        >
          Open
        </button>
      );
    }
    if (item.entityType === "trending_ad") {
      return (
        <button
          type="button"
          onClick={() => openTrendingAd(item.entityId!)}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
        >
          Open
        </button>
      );
    }
    if (item.entityType === "project") {
      return (
        <button
          type="button"
          onClick={() => openProject(item.entityId!)}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
        >
          Open
        </button>
      );
    }
    if (item.entityType === "lead") {
      return (
        <button
          type="button"
          onClick={() => openLead(item.entityId!)}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
        >
          Open
        </button>
      );
    }
    if (item.entityType === "marketing" && item.entityId !== "marketing") {
      return (
        <button
          type="button"
          onClick={() => openMarketingItem(item.entityId!)}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
        >
          Open
        </button>
      );
    }
    return null;
  };

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
              <LikeButton entityType="task" entityId={item.id} />
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

              {openAction(item)}

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
      <TrendingAdDetailSheet
        example={openTrending}
        onClose={() => setOpenTrendingId(null)}
        contentPresets={ads?.contentPresets ?? []}
        onContentGenerated={(updated, idea) => {
          setAds(updated);
          setOpenTrendingId(null);
          setOpenAdIdeaId(idea.id);
        }}
      />
      <ProjectDetailSheet
        project={openProjectItem}
        onClose={() => setOpenProjectId(null)}
        onUpdated={(p) => setProjects((list) => list.map((x) => (x.id === p.id ? p : x)))}
      />
      <LeadDetailSheet lead={openLeadItem} onClose={() => setOpenLeadId(null)} />
      <CampaignDetailSheet
        campaign={openMarketingItemResolved}
        currency={currency}
        onClose={() => setOpenMarketingId(null)}
      />
    </div>
  );
}
