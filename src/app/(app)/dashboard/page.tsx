"use client";

import { useEffect, useState } from "react";
import { DemandList } from "@/components/demand-list";
import { ProjectCard } from "@/components/project-card";
import type { DemandSignal, MarketProject, OnboardingProfile } from "@/lib/types/domain";

export default function DashboardPage() {
  const [profile, setProfile] = useState<OnboardingProfile | null>(null);
  const [demandsByRegion, setDemandsByRegion] = useState<Record<string, DemandSignal[]>>({});
  const [projects, setProjects] = useState<MarketProject[]>([]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.profile);
        setDemandsByRegion(d.demandsByRegion ?? {});
        setProjects(d.projects ?? []);
      });
  }, []);

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Top demands and active projects for{" "}
          <span className="font-medium text-slate-700">{profile?.serviceDomain}</span>
        </p>
      </header>

      {profile?.regions.map((region) => (
        <section key={region} className="space-y-4">
          <h2 className="text-lg font-medium text-slate-800">
            Top 10 demands — {region}
          </h2>
          <DemandList demands={demandsByRegion[region] ?? []} />
        </section>
      ))}

      <section className="space-y-4">
        <h2 className="text-lg font-medium text-slate-800">Active projects by region</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {profile?.regions.map((region) => {
            const regional = projects.filter((p) => p.region === region);
            return (
              <div key={region} className="space-y-3">
                <h3 className="text-sm font-medium text-slate-600">
                  {region} ({regional.length}/10)
                </h3>
                {regional.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
