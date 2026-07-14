"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  PROJECT_LEAD_CATEGORY_COLORS,
  PROJECT_LEAD_CATEGORY_LABELS,
  PROJECT_LEAD_PROGRESS_STAGES,
  type ProjectLeadProgressStage,
} from "@/lib/project-lead-labels";
import type { LeadRecord, MarketProject, PrecedentRecord } from "@/lib/types/domain";

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

function ProjectLeadProgressPanel({
  progress,
  message,
  stages,
}: {
  progress: number;
  message: string;
  stages: ProjectLeadProgressStage[];
}) {
  return (
    <div className="mt-3 rounded-lg border border-violet-100 bg-white p-3">
      <p className="text-xs font-medium text-slate-800">Generating leads…</p>
      <p className="mt-1 text-xs text-slate-600">{message}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-slate-400">{progress}% complete</p>
      <ul className="mt-3 space-y-2">
        {stages.map((stage) => (
          <li key={stage.id} className="flex items-center gap-2 text-xs">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                stage.status === "completed"
                  ? "bg-emerald-400"
                  : stage.status === "running"
                    ? "animate-pulse bg-violet-400"
                    : stage.status === "failed"
                      ? "bg-rose-400"
                      : "bg-slate-200"
              }`}
            />
            <span className="text-slate-700">{stage.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
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
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [doneError, setDoneError] = useState<string | null>(null);
  const [chartMounted, setChartMounted] = useState(false);
  const [generatingLeads, setGeneratingLeads] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateNotice, setGenerateNotice] = useState<string | null>(null);
  const [linkedLeads, setLinkedLeads] = useState<LeadRecord[]>([]);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [copiedMessageKey, setCopiedMessageKey] = useState<string | null>(null);
  const [leadProgress, setLeadProgress] = useState<{
    progress: number;
    message: string;
    stages: ProjectLeadProgressStage[];
  } | null>(null);
  const [showViewLeads, setShowViewLeads] = useState(false);

  useEffect(() => setChartMounted(true), []);

  const leadIds = project?.projectLeadContext?.leadIds ?? [];

  useEffect(() => {
    if (!project || leadIds.length === 0) {
      setLinkedLeads([]);
      return;
    }
    fetch(`/api/leads?ids=${leadIds.join(",")}`)
      .then((r) => r.json())
      .then((d) => setLinkedLeads(d.leads ?? []))
      .catch(() => setLinkedLeads([]));
  }, [project?.id, leadIds.join(",")]);

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

  const generateLeads = async () => {
    setGenerateError(null);
    setGenerateNotice(null);
    setShowViewLeads(false);
    setGeneratingLeads(true);
    setLeadProgress({
      progress: 0,
      message: "Starting lead generation…",
      stages: PROJECT_LEAD_PROGRESS_STAGES.map((stage) => ({
        ...stage,
        status: "pending" as const,
      })),
    });

    try {
      const res = await fetch(`/api/projects/${project.id}/generate-leads`, {
        method: "POST",
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setGenerateError(
          data.message ??
            "Could not generate context and leads. Check your Gemini API key.",
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as {
            type: string;
            progress?: number;
            message?: string;
            stages?: ProjectLeadProgressStage[];
            project?: MarketProject;
            leads?: LeadRecord[];
            addedCount?: number;
            error?: string;
          };

          if (event.type === "progress") {
            setLeadProgress({
              progress: event.progress ?? 0,
              message: event.message ?? "",
              stages: event.stages ?? [],
            });
          }

          if (event.type === "error") {
            setGenerateError(
              event.message ??
                event.error ??
                "Could not generate context and leads.",
            );
            return;
          }

          if (event.type === "complete") {
            if (event.project) onUpdated(event.project);
            const added = event.addedCount ?? event.leads?.length ?? 0;
            if (added === 0) {
              setGenerateNotice(
                "No new unique companies found — existing leads were kept.",
              );
            } else {
              setGenerateNotice(`Added ${added} new lead${added === 1 ? "" : "s"}.`);
            }
            if (event.leads?.length) {
              setLinkedLeads((prev) => {
                const byId = new Map(prev.map((l) => [l.id, l]));
                for (const lead of event.leads ?? []) {
                  byId.set(lead.id, lead);
                }
                return Array.from(byId.values()).sort((a, b) => b.fitScore - a.fitScore);
              });
            }
            setShowViewLeads(true);
          }
        }
      }
    } catch {
      setGenerateError("Could not generate context and leads. Check your Gemini API key.");
    } finally {
      setGeneratingLeads(false);
      setLeadProgress(null);
    }
  };

  const viewProjectLeads = () => {
    router.push(`/leads?project=${project.id}`);
  };

  const copyOpeningMessage = async (leadId: string, index: number, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedMessageKey(`${leadId}-${index}`);
    setTimeout(() => setCopiedMessageKey(null), 1500);
  };

  const ctx = project.projectLeadContext;
  const hasContext = Boolean(ctx);
  const canViewLeads =
    showViewLeads || (hasContext && (linkedLeads.length > 0 || (ctx?.leadIds.length ?? 0) > 0));

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

        <section className="rounded-lg border border-violet-100 bg-violet-50/30 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Context & leads</p>
              <p className="mt-1 text-xs text-slate-600">
                Classify this project, find companies, map CEO problems to your services, and
                draft opening messages.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void generateLeads()}
                disabled={generatingLeads}
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {generatingLeads
                  ? "Generating…"
                  : hasContext
                    ? "Find more leads"
                    : "Generate context & leads"}
              </button>
              {canViewLeads && !generatingLeads && (
                <button
                  type="button"
                  onClick={viewProjectLeads}
                  className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50"
                >
                  View leads
                </button>
              )}
            </div>
          </div>

          {generatingLeads && leadProgress && (
            <ProjectLeadProgressPanel
              progress={leadProgress.progress}
              message={leadProgress.message}
              stages={leadProgress.stages}
            />
          )}

          {generateError && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {generateError}
            </p>
          )}
          {generateNotice && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {generateNotice}
            </p>
          )}

          {hasContext && ctx && (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-700">Keywords</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ctx.keywords.map((k) => (
                    <span
                      key={k}
                      className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700">Categories</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ctx.categories.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-700">Industries</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ctx.industries.map((i) => (
                    <span
                      key={i}
                      className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600"
                    >
                      {i}
                    </span>
                  ))}
                </div>
              </div>

              {ctx.categoryInsights.map((insight) => (
                <div
                  key={insight.category}
                  className="rounded-lg border border-slate-100 bg-white p-3"
                >
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${PROJECT_LEAD_CATEGORY_COLORS[insight.category]}`}
                  >
                    {PROJECT_LEAD_CATEGORY_LABELS[insight.category]}
                  </span>
                  <p className="mt-2 text-xs font-medium text-slate-800">CEO thinking</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {insight.ceoThinking}
                  </p>
                  <p className="mt-3 text-xs font-medium text-slate-800">Top problems</p>
                  <ol className="mt-1 list-inside list-decimal text-xs text-slate-600">
                    {insight.topProblems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ol>
                  <p className="mt-3 text-xs font-medium text-slate-800">How you can help</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    {insight.serviceMapping}
                  </p>
                </div>
              ))}

              {linkedLeads.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-700">
                    Linked leads ({linkedLeads.length})
                  </p>
                  <div className="mt-2 space-y-2">
                    {linkedLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="rounded-lg border border-slate-100 bg-white p-3 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/leads?focus=${lead.id}`)}
                            className="text-left font-medium text-violet-700 hover:underline"
                          >
                            {lead.company}
                          </button>
                          <span className="shrink-0 text-slate-500">Fit {lead.fitScore}</span>
                        </div>
                        {lead.projectLeadCategory && (
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${PROJECT_LEAD_CATEGORY_COLORS[lead.projectLeadCategory]}`}
                          >
                            {PROJECT_LEAD_CATEGORY_LABELS[lead.projectLeadCategory]}
                          </span>
                        )}
                        {lead.openingMessages && lead.openingMessages.length > 0 && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedLeadId((id) => (id === lead.id ? null : lead.id))
                              }
                              className="text-xs font-medium text-slate-600 hover:text-slate-800"
                            >
                              {expandedLeadId === lead.id ? "Hide" : "Show"} opening messages (
                              {lead.openingMessages.length})
                            </button>
                            {expandedLeadId === lead.id && (
                              <div className="mt-2 space-y-2">
                                {lead.openingMessages.map((msg, i) => (
                                  <div
                                    key={i}
                                    className="rounded-lg bg-slate-50 p-2 text-xs text-slate-700"
                                  >
                                    <p className="whitespace-pre-wrap">{msg}</p>
                                    <button
                                      type="button"
                                      onClick={() => void copyOpeningMessage(lead.id, i, msg)}
                                      className="mt-1 text-violet-700 hover:underline"
                                    >
                                      {copiedMessageKey === `${lead.id}-${i}` ? "Copied" : "Copy"}
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

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
