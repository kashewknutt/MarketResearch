"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { AssignTaskButton } from "@/components/assign-task-button";
import { LikeButton } from "@/components/like-button";
import { CommentThread } from "@/components/comment-thread";
import { EditableField } from "@/components/editable-field";
import { PageLoading } from "@/components/ui/page-loading";
import { currencyInputPrefix, formatMoney } from "@/lib/currency";
import type { InvestmentSnapshot, OnboardingProfile } from "@/lib/types/domain";

export default function InvestmentPlannerPage() {
  const [investment, setInvestment] = useState<InvestmentSnapshot | null>(null);
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/investment")
      .then((r) => r.json())
      .then((d) => {
        setInvestment(d.investment);
        setProfile(d.profile ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAppRefresh(load, ["investment", "all"]);

  const patchAllocation = async (
    index: number,
    field: string,
    value: string | number,
  ) => {
    if (!investment) return;
    const allocations = [...investment.allocations];
    allocations[index] = {
      ...allocations[index],
      [field]: value,
      provenance: {
        ...allocations[index].provenance,
        source: "user",
        isUserEdited: true,
      },
    };
    await fetch("/api/investment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allocations }),
    });
    const res = await fetch("/api/investment");
    const d = await res.json();
    setInvestment(d.investment);
    if (d.profile) setProfile(d.profile);
  };

  if (loading) {
    return <PageLoading label="Loading investment plan…" />;
  }

  if (!investment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Investment Planner</h1>
        <p className="text-sm text-slate-500">Run research to generate investment plan.</p>
      </div>
    );
  }

  const money = (n: number) => formatMoney(n, profile?.currency);

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Investment Planner</h1>
          <p className="mt-1 text-sm text-slate-500">
            Where to put money, why it matters, and expected outcomes.
          </p>
          <p className="mt-4 text-2xl font-semibold text-violet-700">
            {money(investment.totalRecommended)} recommended
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LikeButton entityType="investment" entityId="investment" />
          <AssignTaskButton
            entityType="investment"
            entityId="investment"
            defaultTitle="Follow up on investment plan"
          />
        </div>
      </header>

      <CommentThread entityType="investment" entityId="investment" />

      <div className="space-y-4">
        {investment.allocations.map((a, i) => (
          <div
            key={a.category}
            className="rounded-xl border border-slate-100 bg-gradient-to-r from-white to-violet-50/20 p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-slate-800">{a.category}</h3>
              <span className="text-sm font-medium text-slate-600">
                {money(a.amount)} ({a.percentage}%)
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <EditableField
                label="Amount"
                value={a.amount}
                type="number"
                prefix={currencyInputPrefix(profile?.currency)}
                onSave={(v) => patchAllocation(i, "amount", Number(v))}
              />
              <EditableField
                label="Percentage"
                value={a.percentage}
                type="number"
                onSave={(v) => patchAllocation(i, "percentage", Number(v))}
              />
            </div>
            <p className="mt-3 text-xs text-slate-600">
              <strong className="text-slate-700">Why:</strong> {a.rationale}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              <strong>Expected:</strong> {a.expectedOutcome}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
