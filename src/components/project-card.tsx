"use client";

import type { MarketProject } from "@/lib/types/domain";
import { openProject } from "@/components/app-shell";
import { cn } from "@/lib/utils/cn";

export function ProjectCard({ project }: { project: MarketProject }) {
  return (
    <button
      type="button"
      onClick={() => openProject(project)}
      className={cn(
        "w-full rounded-xl border border-slate-100 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md",
        "focus:outline-none focus:ring-2 focus:ring-violet-200",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
          {project.region}
        </span>
        <span className="text-xs text-slate-400 capitalize">{project.effort} effort</span>
      </div>
      <h3 className="text-sm font-semibold text-slate-800">{project.title}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">{project.summary}</p>
      <p className="mt-3 text-xs font-medium text-emerald-700">
        {project.currency} {project.ticketSize.toLocaleString()}
      </p>
    </button>
  );
}
