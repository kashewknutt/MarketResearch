"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppRefresh } from "@/lib/hooks/use-app-refresh";
import { AssignTaskButton } from "@/components/assign-task-button";
import { LikeButton } from "@/components/like-button";
import { CommentThread } from "@/components/comment-thread";
import { EditableField } from "@/components/editable-field";
import { ProjectCard } from "@/components/project-card";
import { PageLoading } from "@/components/ui/page-loading";
import type { MarketProject, StrategySnapshot } from "@/lib/types/domain";

export default function StrategyPage() {
  const [strategy, setStrategy] = useState<StrategySnapshot | null>(null);
  const [projects, setProjects] = useState<MarketProject[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch("/api/strategy")
      .then((r) => r.json())
      .then((d) => setStrategy(d.strategy))
      .finally(() => setLoading(false));
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAppRefresh(load, ["strategy", "all"]);

  const patch = async (updates: Partial<StrategySnapshot>) => {
    await fetch("/api/strategy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const res = await fetch("/api/strategy");
    const d = await res.json();
    setStrategy(d.strategy);
  };

  if (loading) {
    return <PageLoading label="Loading strategy…" />;
  }

  if (!strategy) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Strategy</h1>
        <p className="text-sm text-slate-500">Run research to generate strategy insights.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Strategy</h1>
          <p className="mt-1 text-sm text-slate-500">
            Understand targets, requirements, and where to focus.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LikeButton entityType="strategy" entityId="strategy" />
          <AssignTaskButton
            entityType="strategy"
            entityId="strategy"
            defaultTitle="Follow up on strategy"
          />
        </div>
      </header>

      <CommentThread entityType="strategy" entityId="strategy" />

      <EditableField
        label="Ideal customer profile"
        value={strategy.idealCustomerProfile}
        type="textarea"
        provenance={strategy.provenance.source}
        onSave={(v) => patch({ idealCustomerProfile: String(v) })}
      />

      <EditableField
        label="Market fit"
        value={strategy.marketFit}
        type="textarea"
        onSave={(v) => patch({ marketFit: String(v) })}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Region comparison</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(strategy.regionComparison).map(([region, text]) => (
            <div key={region} className="rounded-xl border border-slate-100 bg-sky-50/30 p-4">
              <h3 className="text-sm font-medium text-sky-800">{region}</h3>
              <p className="mt-2 text-xs text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <ListSection title="Demand clusters" items={strategy.demandClusters} />
      <ListSection title="Priorities" items={strategy.priorities} />
      <ListSection title="Expansion opportunities" items={strategy.expansionOpportunities} />
      <ListSection title="Risks" items={strategy.risks} />

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">Strategic projects</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.slice(0, 6).map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{title}</h2>
      <ul className="space-y-1 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="rounded-lg bg-slate-50 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
