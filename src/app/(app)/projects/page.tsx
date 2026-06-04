"use client";

import { useEffect, useState } from "react";
import { ProjectCard } from "@/components/project-card";
import type { MarketProject } from "@/lib/types/domain";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<MarketProject[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setProjects(d.projects ?? []);
        setRegions(d.regions ?? []);
      });
  }, []);

  const filtered =
    filter === "all" ? projects : projects.filter((p) => p.region === filter);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800">Projects</h1>
        <p className="mt-1 text-sm text-slate-500">
          10 active opportunities per region. Mark done to get a new AI-sourced project.
        </p>
      </header>
      <div className="flex gap-2">
        <FilterBtn active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {regions.map((r) => (
          <FilterBtn key={r} active={filter === r} onClick={() => setFilter(r)} label={r} />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <ProjectCard key={p.id} project={p} />
        ))}
      </div>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-violet-100 text-violet-800" : "bg-slate-50 text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
