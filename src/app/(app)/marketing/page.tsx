"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { createColumnHelper } from "@tanstack/react-table";
import { AssignTaskButton } from "@/components/assign-task-button";
import { LikeCell } from "@/components/like-cell";
import { useLikeSummaries } from "@/lib/hooks/use-like-summaries";
import type { LikeCount } from "@/lib/store/likes";
import { DataTable } from "@/components/ui/data-table";
import { CitationList } from "@/components/ui/citation-list";
import { Tabs } from "@/components/ui/tabs";
import { CampaignDetailSheet } from "@/components/campaign-detail-sheet";
import { formatMoney } from "@/lib/currency";
import type {
  MarketingItem,
  MarketingSnapshot,
  MarketingSocialSnapshot,
} from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

const itemCol = createColumnHelper<MarketingItem>();

function campaignColumns(
  currency: string,
  likes: Record<string, LikeCount>,
  toggle: (id: string) => void,
): ColumnDef<MarketingItem>[] {
  return [
    itemCol.display({
      id: "liked",
      header: "Liked",
      cell: ({ row }) => (
        <LikeCell liked={likes[row.original.id]} onToggle={() => toggle(row.original.id)} />
      ),
    }),
    itemCol.accessor("title", { header: "Campaign" }),
    itemCol.accessor("priority", { header: "Priority" }),
    itemCol.accessor("why", {
      header: "Why",
      cell: (i) => i.getValue() ?? "—",
    }),
    itemCol.display({
      id: "cost",
      header: `Est. cost (${currency})`,
      cell: ({ row }) =>
        row.original.estimatedCost != null
          ? formatMoney(row.original.estimatedCost, row.original.estimatedCostCurrency ?? currency)
          : "—",
    }),
    itemCol.display({
      id: "sources",
      header: "Sources",
      cell: ({ row }) =>
        (row.original.citations?.length ?? 0) + row.original.provenance.citations.length,
    }),
  ] as ColumnDef<MarketingItem>[];
}

export default function MarketingPage() {
  const [tab, setTab] = useState("overview");
  const [marketing, setMarketing] = useState<MarketingSnapshot | null>(null);
  const [social, setSocial] = useState<MarketingSocialSnapshot | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [selectedCampaign, setSelectedCampaign] = useState<MarketingItem | null>(null);

  const load = useCallback(() => {
    fetch("/api/marketing")
      .then((r) => r.json())
      .then((d) => setMarketing(d.marketing));
    fetch("/api/marketing/social")
      .then((r) => r.json())
      .then((d) => setSocial(d.social));
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setCurrency(d.profile?.currency ?? "USD"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAppRefresh(load, ["marketing", "all"]);

  const allCampaigns = useMemo(
    () =>
      marketing
        ? [
            ...marketing.contentThemes,
            ...marketing.offers,
            ...marketing.channels,
            ...marketing.proofAssets,
          ]
        : [],
    [marketing],
  );
  const allCampaignIds = useMemo(() => allCampaigns.map((c) => c.id), [allCampaigns]);
  const {
    likes: campaignLikes,
    toggle: toggleCampaignLike,
    refresh: refreshCampaignLikes,
  } = useLikeSummaries("marketing", allCampaignIds);
  const campaignColumnsMemo = useMemo(
    () => campaignColumns(currency, campaignLikes, toggleCampaignLike),
    [currency, campaignLikes, toggleCampaignLike],
  );
  const isCampaignLiked = useCallback(
    (row: MarketingItem) => campaignLikes[row.id]?.likedByMe ?? false,
    [campaignLikes],
  );

  if (!marketing) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Marketing</h1>
        <p className="text-sm text-slate-500">Run research to generate marketing recommendations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Marketing</h1>
          <p className="mt-1 text-xs text-slate-500">Amounts in {currency} where applicable</p>
        </div>
        <AssignTaskButton
          entityType="marketing"
          entityId="marketing"
          defaultTitle="Follow up on marketing"
          className="shrink-0"
        />
      </header>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "campaigns", label: "Campaigns" },
          { id: "social", label: "Social platforms" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "overview" && (
        <p className="rounded-xl bg-emerald-50/50 p-4 text-sm text-slate-700">
          {marketing.positioning}
        </p>
      )}

      {tab === "campaigns" && (
        <div className="space-y-6">
          <p className="text-xs text-slate-500">Click a row for full campaign dossier.</p>
          <DataTable
            data={allCampaigns}
            columns={campaignColumnsMemo}
            onRowClick={(row) => setSelectedCampaign(row)}
            isLiked={isCampaignLiked}
          />
          <CampaignDetailSheet
            campaign={selectedCampaign}
            currency={currency}
            onClose={() => {
              setSelectedCampaign(null);
              refreshCampaignLikes();
            }}
          />
        </div>
      )}

      {tab === "social" && (
        <div className="space-y-4">
          {!social?.platforms?.length ? (
            <p className="text-sm text-slate-500">Run research to generate social playbooks.</p>
          ) : (
            social.platforms.map((p) => (
              <div key={p.platform} className="rounded-xl border border-slate-100 p-5">
                <h3 className="text-base font-semibold text-slate-800">{p.platform}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Audience: {p.audience} · Cadence: {p.postingCadence}
                </p>
                <p className="mt-3 text-sm font-medium text-violet-800">How this differs</p>
                <p className="text-xs text-slate-600">{p.differentiation}</p>
                <p className="mt-3 text-sm font-medium text-slate-800">Tactics</p>
                <ul className="list-inside list-disc text-xs text-slate-600">
                  {p.tactics.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <CitationList citations={p.citations} compact />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
