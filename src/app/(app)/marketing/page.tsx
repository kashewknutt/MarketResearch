"use client";

import { useEffect, useState } from "react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { CitationList } from "@/components/ui/citation-list";
import { Tabs } from "@/components/ui/tabs";
import { CampaignDetailSheet } from "@/components/campaign-detail-sheet";
import { GeminiFallback } from "@/components/gemini-fallback";
import { formatMoney } from "@/lib/currency";
import type {
  MarketingItem,
  MarketingSnapshot,
  MarketingSocialSnapshot,
} from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

const itemCol = createColumnHelper<MarketingItem>();

function campaignColumns(currency: string): ColumnDef<MarketingItem>[] {
  return [
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

  useEffect(() => {
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

  if (!marketing) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Marketing</h1>
        <GeminiFallback title="Run research to generate marketing recommendations" verify />
      </div>
    );
  }

  const allCampaigns = [
    ...marketing.contentThemes,
    ...marketing.offers,
    ...marketing.channels,
    ...marketing.proofAssets,
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Marketing</h1>
        <p className="mt-1 text-xs text-slate-500">Amounts in {currency} where applicable</p>
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
            columns={campaignColumns(currency)}
            onRowClick={(row) => setSelectedCampaign(row)}
          />
          <CampaignDetailSheet
            campaign={selectedCampaign}
            currency={currency}
            onClose={() => setSelectedCampaign(null)}
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
