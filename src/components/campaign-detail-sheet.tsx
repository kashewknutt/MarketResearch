"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import { AssignTaskButton } from "@/components/assign-task-button";
import { LikeButton } from "@/components/like-button";
import { CitationList } from "@/components/ui/citation-list";
import { formatMoney } from "@/lib/currency";
import type { MarketingItem } from "@/lib/types/domain";

interface CampaignDetailSheetProps {
  campaign: MarketingItem | null;
  currency: string;
  onClose: () => void;
}

export function CampaignDetailSheet({
  campaign,
  currency,
  onClose,
}: CampaignDetailSheetProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!campaign) return null;

  const cost =
    campaign.estimatedRunCost ??
    campaign.estimatedCost ??
    null;
  const costCurrency = campaign.estimatedCostCurrency ?? currency;
  const allCitations = [
    ...(campaign.citations ?? []),
    ...campaign.provenance.citations,
  ];
  const metrics = campaign.expectedMetrics ?? [];
  const costChart =
    cost != null
      ? [{ label: campaign.title.slice(0, 24), amount: cost }]
      : metrics
          .filter((m) => /cost|spend|budget/i.test(m.label))
          .map((m) => ({
            label: m.label,
            amount: parseFloat(m.value.replace(/[^0-9.]/g, "")) || 0,
          }))
          .filter((x) => x.amount > 0);

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">{campaign.title}</h2>
        <div className="flex items-center gap-2">
          <LikeButton entityType="marketing" entityId={campaign.id} />
          <AssignTaskButton
            entityType="marketing"
            entityId={campaign.id}
            defaultTitle={campaign.title}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
          {campaign.category} · {campaign.priority}
        </span>
        <p className="text-xs text-slate-600">{campaign.description}</p>

        {(campaign.whyForBusiness || campaign.why) && (
          <section className="rounded-lg bg-violet-50/40 p-4">
            <p className="text-sm font-medium text-slate-800">Why for your business</p>
            <p className="mt-1 text-xs text-slate-700">
              {campaign.whyForBusiness ?? campaign.why}
            </p>
          </section>
        )}

        {(campaign.regions?.length || campaign.region) && (
          <section>
            <p className="text-sm font-medium text-slate-800">Regions</p>
            <p className="mt-1 text-xs text-slate-600">
              {(campaign.regions ?? [campaign.region]).filter(Boolean).join(", ")}
            </p>
          </section>
        )}

        {campaign.channels && campaign.channels.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Channels</p>
            <p className="mt-1 text-xs text-slate-600">{campaign.channels.join(", ")}</p>
          </section>
        )}

        {(campaign.runDuration || campaign.operatorType) && (
          <p className="text-xs text-slate-500">
            {campaign.runDuration && <>Duration: {campaign.runDuration}. </>}
            {campaign.operatorType && <>Operator: {campaign.operatorType}.</>}
          </p>
        )}

        {cost != null && (
          <p className="text-sm font-semibold text-violet-700">
            Est. run cost: {formatMoney(cost, costCurrency)}
          </p>
        )}

        {mounted && costChart.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Cost breakdown</p>
            <div className="mt-2 h-40 min-h-[10rem] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v) => formatMoney(Number(v), costCurrency)} />
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {metrics.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Expected metrics</p>
            <table className="mt-2 w-full text-xs">
              <tbody>
                {metrics.map((m) => (
                  <tr key={m.label} className="border-t border-slate-100">
                    <td className="py-2 text-slate-600">{m.label}</td>
                    <td className="py-2 text-right font-medium text-slate-800">
                      {m.value}
                      {m.unit ? ` ${m.unit}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {campaign.successCases && campaign.successCases.length > 0 && (
          <section>
            <p className="text-sm font-medium text-emerald-800">Success precedents</p>
            <div className="mt-2 space-y-2">
              {campaign.successCases.map((p, i) => (
                <div key={i} className="rounded-lg border border-emerald-100 p-3 text-xs">
                  <p className="font-medium">{p.company}</p>
                  <p className="text-slate-600">{p.action}</p>
                  <p className="text-emerald-700">{p.reportedResult}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {campaign.failureCases && campaign.failureCases.length > 0 && (
          <section>
            <p className="text-sm font-medium text-rose-800">Failure precedents</p>
            <div className="mt-2 space-y-2">
              {campaign.failureCases.map((p, i) => (
                <div key={i} className="rounded-lg border border-rose-100 p-3 text-xs">
                  <p className="font-medium">{p.company}</p>
                  <p className="text-slate-600">{p.action}</p>
                  <p className="text-rose-700">{p.reportedResult}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {campaign.precedents && campaign.precedents.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Precedents</p>
            <div className="mt-2 space-y-2">
              {campaign.precedents.map((p, i) => (
                <div key={i} className="rounded-lg border border-slate-100 p-3 text-xs">
                  <p className="font-medium">{p.company}</p>
                  <p className="text-slate-600">{p.reportedResult}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {campaign.executionNotes && (
          <section>
            <p className="text-sm font-medium text-slate-800">Execution notes</p>
            <p className="mt-1 text-xs text-slate-600">{campaign.executionNotes}</p>
          </section>
        )}

        <section>
          <p className="text-sm font-medium text-slate-800">Citations</p>
          <CitationList citations={allCitations} />
        </section>
      </div>
    </div>
  );
}
