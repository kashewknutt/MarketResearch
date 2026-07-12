"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AssignTaskButton } from "@/components/assign-task-button";
import { CommentThread } from "@/components/comment-thread";
import { LikeButton } from "@/components/like-button";
import { EditableField } from "@/components/editable-field";
import { CitationList } from "@/components/ui/citation-list";
import { formatMoney } from "@/lib/currency";
import type { MarketProject, PrecedentRecord } from "@/lib/types/domain";

function parsePrecedentMetric(metric?: string): number | null {
  if (!metric) return null;
  const m = metric.match(/[\d,.]+/);
  if (!m) return null;
  return parseFloat(m[0].replace(/,/g, ""));
}

function precedentChartRows(precedents: PrecedentRecord[]) {
  return precedents.map((p, i) => ({
    name: p.company.length > 18 ? `${p.company.slice(0, 16)}…` : p.company,
    value: parsePrecedentMetric(p.metric) ?? (i + 1) * 10,
    detail: p.metric ?? p.reportedResult,
  }));
}

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
  const [chartMounted, setChartMounted] = useState(false);

  useEffect(() => setChartMounted(true), []);

  const precedentChart = useMemo(
    () => (project?.precedents?.length ? precedentChartRows(project.precedents) : []),
    [project?.precedents],
  );

  const hasCitationUrls = (project?.provenance.citations ?? []).some((c) => c.uri?.trim());

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
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">Project analysis</h2>
        <div className="flex items-center gap-2">
          <LikeButton entityType="project" entityId={project.id} />
          <AssignTaskButton
            entityType="project"
            entityId={project.id}
            defaultTitle={project.title}
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
        <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
          {project.region}
          {project.confidenceScore != null &&
            ` · ${Math.round(project.confidenceScore * 100)}% confidence`}
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

        {project.rationale && (
          <section className="rounded-lg bg-violet-50/40 p-4">
            <p className="text-sm font-medium text-slate-800">Why this project</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">{project.rationale}</p>
          </section>
        )}

        {project.regionalPricing && project.regionalPricing.length > 0 && (
          <section>
            <p className="mb-2 text-sm font-medium text-slate-800">Regional pricing (sourced)</p>
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="py-1 text-left">Region</th>
                  <th className="py-1 text-left">Min–Max</th>
                  <th className="py-1 text-left">Median</th>
                </tr>
              </thead>
              <tbody>
                {project.regionalPricing.map((rp) => (
                  <tr key={rp.region} className="border-t border-slate-100">
                    <td className="py-2">{rp.region}</td>
                    <td className="py-2">
                      {formatMoney(rp.min, rp.currency)} – {formatMoney(rp.max, rp.currency)}
                    </td>
                    <td className="py-2">{formatMoney(rp.median, rp.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {project.challenges && project.challenges.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Challenges</p>
            <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
              {project.challenges.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </section>
        )}

        {project.solutions && project.solutions.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Solutions</p>
            <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
              {project.solutions.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        {project.precedents && project.precedents.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Precedents</p>
            <div className="mt-2 space-y-2">
              {project.precedents.map((p, i) => (
                <div key={i} className="rounded-lg border border-slate-100 p-3 text-xs">
                  <p className="font-medium text-slate-800">{p.company}</p>
                  <p className="text-slate-600">{p.action}</p>
                  <p className="mt-1 text-emerald-800">{p.reportedResult}</p>
                  {p.metric && <p className="text-slate-500">Metric: {p.metric}</p>}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
          <p className="mb-2 font-medium text-slate-800">Explanation</p>
          <p className="text-xs leading-relaxed">{project.explanation}</p>
        </div>
        <div className="rounded-lg bg-emerald-50/50 p-4 text-sm">
          <p className="font-medium text-emerald-800">Next step</p>
          <p className="mt-1 text-xs text-emerald-700">{project.nextStep}</p>
        </div>
        <p className="text-xs text-slate-500">{project.expectedValue}</p>

        <section>
          <p className="text-sm font-medium text-slate-800">Sources</p>
          {!hasCitationUrls && precedentChart.length > 0 ? (
            <p className="mb-2 text-xs text-slate-500">
              No URLs; see precedent chart below.
            </p>
          ) : null}
          <CitationList citations={project.provenance.citations} />
        </section>

        {!hasCitationUrls && precedentChart.length > 0 && chartMounted && (
          <section>
            <p className="text-sm font-medium text-slate-800">Evidence from precedents</p>
            <div className="mt-2 h-48 min-h-[12rem] min-w-0 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={precedentChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip
                    formatter={(v) => String(v)}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.detail ?? ""
                    }
                  />
                  <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {doneError && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{doneError}</p>
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

        <CommentThread entityType="project" entityId={project.id} />
      </div>
    </div>
  );
}
