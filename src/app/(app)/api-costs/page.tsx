"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiCostEventRecord } from "@/lib/ai/pricing-types";
import type { ModelPricingRates } from "@/lib/ai/pricing-types";

interface CostSummaryResponse {
  summary: {
    totals: {
      totalUsd: number;
      inputUsd: number;
      outputUsd: number;
      searchUsd: number;
      callCount: number;
      successCount: number;
      totalTokens: number;
      searchQueries: number;
    };
    byCategory: Array<{ category: string; totalUsd: number; count: number }>;
    pricing: ModelPricingRates;
    billingTier: string;
    monthlySearchQueriesUsed: number;
    monthlySearchFreeQuota: number;
  };
  events: ApiCostEventRecord[];
}

function usd(n: number) {
  if (n < 0.0001 && n > 0) return "<$0.0001";
  return `$${n.toFixed(4)}`;
}

export default function ApiCostsPage() {
  const [data, setData] = useState<CostSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingPricing, setRefreshingPricing] = useState(false);

  const load = useCallback(async (refreshPricing = false, showLoading = true) => {
    if (showLoading) setLoading(true);
    const res = await fetch(
      `/api/costs?limit=200${refreshPricing ? "&refreshPricing=true" : ""}`,
    );
    const json = await res.json();
    setData(json);
    setLoading(false);
    setRefreshingPricing(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/costs?limit=200");
      if (cancelled) return;
      const json = await res.json();
      setData(json);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPricing = async () => {
    setRefreshingPricing(true);
    await load(true);
  };

  if (loading && !data) {
    return <p className="text-sm text-slate-500">Loading cost data…</p>;
  }

  const s = data?.summary;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">API Costs</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Every Gemini and Google Search call is logged with tokens, search queries,
            and estimated USD cost using live pricing from Google&apos;s docs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refreshPricing()}
          disabled={refreshingPricing}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          {refreshingPricing ? "Refreshing…" : "Refresh live pricing"}
        </button>
      </header>

      {s && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total estimated" value={usd(s.totals.totalUsd)} />
            <Stat label="API calls" value={String(s.totals.callCount)} />
            <Stat label="Tokens used" value={s.totals.totalTokens.toLocaleString()} />
            <Stat
              label="Search queries (month)"
              value={`${s.monthlySearchQueriesUsed} / ${s.monthlySearchFreeQuota} free`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-violet-50/30 p-5">
              <h2 className="text-sm font-semibold text-slate-800">Live pricing rates</h2>
              <p className="mt-1 text-xs text-slate-500">
                {s.pricing.sourceLabel} · {s.pricing.parseMethod} ·{" "}
                <a
                  href={s.pricing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-700 underline"
                >
                  View source
                </a>
              </p>
              <ul className="mt-4 space-y-1 text-sm text-slate-700">
                <li>Input: ${s.pricing.inputPerMillionUsd}/1M tokens</li>
                <li>Output: ${s.pricing.outputPerMillionUsd}/1M tokens</li>
                <li>
                  Search: ${s.pricing.searchPerThousandQueriesUsd}/1k queries (after{" "}
                  {s.pricing.freeSearchQueriesPerMonth.toLocaleString()} free/mo)
                </li>
                <li>Billing tier assumed: {s.billingTier}</li>
              </ul>
            </div>
            <div className="rounded-xl border border-slate-100 p-5">
              <h2 className="text-sm font-semibold text-slate-800">Cost by category</h2>
              <ul className="mt-4 space-y-2">
                {s.byCategory.map((row) => (
                  <li
                    key={row.category}
                    className="flex justify-between text-sm text-slate-600"
                  >
                    <span className="capitalize">{row.category}</span>
                    <span>
                      {usd(row.totalUsd)} ({row.count} calls)
                    </span>
                  </li>
                ))}
                {s.byCategory.length === 0 && (
                  <li className="text-xs text-slate-400">No calls recorded yet.</li>
                )}
              </ul>
            </div>
          </div>
        </>
      )}

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-800">
          Call log (traceable)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full min-w-[800px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Operation</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Trace</th>
                <th className="px-3 py-2">Tokens</th>
                <th className="px-3 py-2">Search</th>
                <th className="px-3 py-2">Cost</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.events.map((e) => (
                <tr key={e.id} className="border-t border-slate-50 align-top">
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {e.operation}
                  </td>
                  <td className="px-3 py-2 capitalize text-slate-600">
                    {e.category}
                  </td>
                  <td className="px-3 py-2 text-slate-500">
                    {e.correlationId && (
                      <span className="block">job: {e.correlationId.slice(0, 8)}…</span>
                    )}
                    {e.region && <span className="block">region: {e.region}</span>}
                    {e.researchStage && (
                      <span className="block">stage: {e.researchStage}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {e.inputTokens} in / {e.outputTokens} out
                    {e.thinkingTokens > 0 && ` / ${e.thinkingTokens} think`}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {e.searchQueryCount > 0
                      ? `${e.searchQueryCount} (${usd(e.costSearchUsd)})`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-800">
                    {usd(e.costTotalUsd)}
                  </td>
                  <td className="px-3 py-2">
                    {e.success ? (
                      <span className="text-emerald-600">OK</span>
                    ) : (
                      <span className="text-rose-600" title={e.errorMessage ?? ""}>
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!data?.events.length || data.events.length === 0) && (
            <p className="p-6 text-center text-sm text-slate-400">
              No API calls logged yet. Run setup checks or research to see costs.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-800">{value}</p>
    </div>
  );
}
