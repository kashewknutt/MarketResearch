"use client";

import { useEffect, useState } from "react";
import { GeminiFallback } from "@/components/gemini-fallback";
import { ProjectCard } from "@/components/project-card";
import type { MarketingItem, MarketingSnapshot, MarketProject } from "@/lib/types/domain";

export default function MarketingPage() {
  const [marketing, setMarketing] = useState<MarketingSnapshot | null>(null);
  const [projects, setProjects] = useState<MarketProject[]>([]);

  useEffect(() => {
    fetch("/api/marketing")
      .then((r) => r.json())
      .then((d) => setMarketing(d.marketing));
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects((d.projects ?? []).slice(0, 6)));
  }, []);

  if (!marketing) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-slate-800">Marketing</h1>
        <GeminiFallback title="Run research to generate marketing recommendations" verify />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Marketing</h1>
        <p className="mt-2 rounded-xl bg-emerald-50/50 p-4 text-sm text-slate-700">
          {marketing.positioning}
        </p>
      </header>

      <MarketingSection title="Content themes" items={marketing.contentThemes} />
      <MarketingSection title="Offers to promote" items={marketing.offers} />
      <MarketingSection title="Channel priorities" items={marketing.channels} />
      <MarketingSection title="Proof & trust assets" items={marketing.proofAssets} />

      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          Projects to market now
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MarketingSection({
  title,
  items,
}: {
  title: string;
  items: MarketingItem[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-100 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-800">{item.title}</h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  item.priority === "high"
                    ? "bg-rose-100 text-rose-700"
                    : item.priority === "medium"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.priority}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            {item.region && (
              <p className="mt-2 text-[10px] text-sky-600">{item.region}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
