"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DataTable } from "@/components/ui/data-table";
import { MetricCard } from "@/components/ui/metric-card";
import { formatMoney } from "@/lib/currency";
import type {
  CompetitorSnapshot,
  DashboardMetrics,
  DemandSignal,
  LeadRecord,
  MarketProject,
  OnboardingProfile,
} from "@/lib/types/domain";
import type { ColumnDef } from "@tanstack/react-table";

export default function DashboardPage() {
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [competitors, setCompetitors] = useState<CompetitorSnapshot | null>(null);
  const [leads, setLeads] = useState<LeadRecord[]>([]);
  const [demandsByRegion, setDemandsByRegion] = useState<Record<string, DemandSignal[]>>({});
  const [projects, setProjects] = useState<MarketProject[]>([]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.profile);
        setMetrics(d.metrics);
        setCompetitors(d.competitors);
        setLeads(d.leads ?? []);
        setDemandsByRegion(d.demandsByRegion ?? {});
        setProjects(d.projects ?? []);
      });
  }, []);

  if (!profile || !metrics) {
    return <p className="text-sm text-slate-500">Loading dashboard…</p>;
  }

  const money = (n: number) => formatMoney(n, metrics.currency);
  const demandChart = Object.entries(metrics.regionalDemandCounts).map(([region, count]) => ({
    region,
    count,
  }));

  const competitorColumns: ColumnDef<CompetitorSnapshot["competitors"][0]>[] = [
    { accessorKey: "name", header: "Competitor" },
    {
      id: "spend",
      header: `Est. marketing spend (${competitors?.spendCurrency ?? metrics.currency})`,
      cell: ({ row }) =>
        `${formatMoney(row.original.estimatedMarketingSpendMin, row.original.spendCurrency)} – ${formatMoney(row.original.estimatedMarketingSpendMax, row.original.spendCurrency)}`,
    },
    { accessorKey: "positioning", header: "Positioning" },
  ];

  const leadColumns: ColumnDef<LeadRecord>[] = [
    { accessorKey: "company", header: "Company" },
    { accessorKey: "region", header: "Region" },
    { accessorKey: "fitScore", header: "Fit" },
    { accessorKey: "whyFit", header: "Why" },
  ];

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          {profile.serviceDomain} · all figures in {metrics.currency}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Current MRR" value={money(metrics.currentMrr)} currency={metrics.currency} />
        <MetricCard label="Target MRR" value={money(metrics.targetMrr)} currency={metrics.currency} />
        <MetricCard label="Gap to target" value={money(metrics.gapToGoal)} currency={metrics.currency} />
        <MetricCard label="Leads found" value={String(metrics.leadCount)} currency={metrics.currency} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Planned MRR path</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.mrrSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => money(Number(v))} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v) => money(Number(v ?? 0))} />
                <Line type="monotone" dataKey="mrr" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-slate-100 p-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Demands by region</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demandChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="region" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {competitors && competitors.competitors.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Competitor marketing spend</h2>
          <p className="mb-4 text-xs text-slate-500">
            Recommended for you: {money(competitors.userRecommendedSpendMin)} –{" "}
            {money(competitors.userRecommendedSpendMax)} / month
          </p>
          <DataTable data={competitors.competitors} columns={competitorColumns} />
        </section>
      )}

      {leads.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold text-slate-700">Recent leads</h2>
          <DataTable data={leads} columns={leadColumns} />
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-medium text-slate-800">Active projects ({projects.length})</h2>
        <p className="text-sm text-slate-500">
          See full analysis in Projects — {Object.keys(demandsByRegion).length} regions tracked.
        </p>
      </section>
    </div>
  );
}
