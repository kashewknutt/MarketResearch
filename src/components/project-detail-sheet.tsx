"use client";

import { useState } from "react";
import { EditableField } from "@/components/editable-field";
import type { MarketProject } from "@/lib/types/domain";

interface ProjectDetailSheetProps {
  project: MarketProject | null;
  onClose: () => void;
  onUpdated: (project: MarketProject) => void;
}

export function ProjectDetailSheet({
  project,
  onClose,
  onUpdated,
}: ProjectDetailSheetProps) {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doneError, setDoneError] = useState<string | null>(null);

  if (!project) return null;

  const patch = async (updates: Partial<MarketProject>) => {
    const res = await fetch(`/api/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.project) onUpdated(data.project);
  };

  const markDone = async () => {
    setDoneError(null);
    setLoading(true);
    const res = await fetch(`/api/projects/${project.id}/done`, {
      method: "POST",
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setDoneError(
        data.message ?? "Could not fetch a replacement project. Check your Gemini API key.",
      );
      return;
    }

    setDone(true);
    onClose();
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">Project Details</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
          {project.region}
        </span>
        <EditableField
          label="Title"
          value={project.title}
          provenance={project.provenance.isUserEdited ? "user" : project.provenance.source}
          onSave={(v) => patch({ title: String(v) })}
        />
        <EditableField
          label="Summary"
          value={project.summary}
          type="textarea"
          provenance={project.provenance.source}
          onSave={(v) => patch({ summary: String(v) })}
        />
        <EditableField
          label="Ticket size"
          value={project.ticketSize}
          type="number"
          prefix={`${project.currency} `}
          onSave={(v) => patch({ ticketSize: Number(v) })}
        />
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          <p className="mb-2 font-medium text-slate-800">Explanation</p>
          <p className="text-xs leading-relaxed">{project.explanation}</p>
        </div>
        <div className="rounded-lg bg-emerald-50/50 p-4 text-sm">
          <p className="font-medium text-emerald-800">Next step</p>
          <p className="mt-1 text-xs text-emerald-700">{project.nextStep}</p>
        </div>
        <p className="text-xs text-slate-500">{project.expectedValue}</p>
        {doneError && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {doneError}
          </p>
        )}
        <label className="flex items-center gap-2 rounded-lg border border-slate-100 p-3">
          <input
            type="checkbox"
            checked={done || project.status === "done"}
            disabled={loading || project.status === "done"}
            onChange={() => void markDone()}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">Mark as done (AI will fetch 1 new project)</span>
        </label>
      </div>
    </div>
  );
}
