"use client";

import { useState } from "react";
import type { MarketProject } from "@/lib/types/domain";

interface FetchProjectsFormProps {
  regions: string[];
  onClose: () => void;
  onFetched: (projects: MarketProject[]) => void;
}

const CUSTOM_REGION_VALUE = "__custom__";
export const MAX_FETCH_COUNT = 10;

interface FetchProgress {
  completed: number;
  total: number;
  title: string;
}

export function FetchProjectsForm({ regions, onClose, onFetched }: FetchProjectsFormProps) {
  const [regionChoice, setRegionChoice] = useState(regions[0] ?? CUSTOM_REGION_VALUE);
  const [customRegion, setCustomRegion] = useState("");
  const region = regionChoice === CUSTOM_REGION_VALUE ? customRegion : regionChoice;
  const [count, setCount] = useState("5");
  const [serviceDomain, setServiceDomain] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [constraints, setConstraints] = useState("");
  const [strategicGoals, setStrategicGoals] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<FetchProgress | null>(null);

  const numericCount = Number(count);
  const canSubmit =
    region.trim() &&
    Number.isFinite(numericCount) &&
    numericCount >= 1 &&
    numericCount <= MAX_FETCH_COUNT;

  const submit = async () => {
    setError(null);
    setSaving(true);
    setProgress({ completed: 0, total: numericCount, title: "" });

    try {
      const res = await fetch("/api/projects/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          count: numericCount,
          serviceDomain: serviceDomain.trim() || undefined,
          targetAudience: targetAudience.trim() || undefined,
          constraints: constraints.trim() || undefined,
          strategicGoals: strategicGoals.trim() || undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? data.error ?? "Could not fetch projects.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fetched: MarketProject[] = [];

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
            completed?: number;
            total?: number;
            title?: string;
            projects?: MarketProject[];
            message?: string;
            error?: string;
          };

          if (event.type === "progress") {
            setProgress({
              completed: event.completed ?? 0,
              total: event.total ?? numericCount,
              title: event.title ?? "",
            });
          } else if (event.type === "complete") {
            fetched = event.projects ?? [];
          } else if (event.type === "error") {
            setError(event.message ?? "Could not fetch projects.");
          }
        }
      }

      if (fetched.length > 0) onFetched(fetched);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-end bg-black/20">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Fetch projects</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Run the AI research pipeline for a region and pull in new opportunities,
          without waiting for existing ones to be marked done.
        </p>

        {saving && progress ? (
          <FetchProgressView progress={progress} />
        ) : (
          <>
            <div className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500">Region</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={regionChoice}
                  onChange={(e) => setRegionChoice(e.target.value)}
                >
                  {regions.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value={CUSTOM_REGION_VALUE}>Custom region…</option>
                </select>
                {regionChoice === CUSTOM_REGION_VALUE && (
                  <input
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    value={customRegion}
                    onChange={(e) => setCustomRegion(e.target.value)}
                    placeholder="e.g. Germany"
                    autoFocus
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500">
                  Number of projects (max {MAX_FETCH_COUNT} at a time)
                </label>
                <input
                  type="number"
                  min={1}
                  max={MAX_FETCH_COUNT}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  value={count}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isFinite(next) && next > MAX_FETCH_COUNT) {
                      setCount(String(MAX_FETCH_COUNT));
                    } else {
                      setCount(e.target.value);
                    }
                  }}
                />
              </div>

              <Field
                label="Service domain (optional override)"
                value={serviceDomain}
                onChange={setServiceDomain}
                placeholder="Defaults to your onboarding profile"
              />
              <Field
                label="Target audience (optional override)"
                value={targetAudience}
                onChange={setTargetAudience}
                placeholder="Defaults to your onboarding profile"
                multiline
              />
              <Field
                label="Strategic goals (optional override)"
                value={strategicGoals}
                onChange={setStrategicGoals}
                multiline
              />
              <Field
                label="Constraints (optional override)"
                value={constraints}
                onChange={setConstraints}
                multiline
              />
            </div>

            {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={submit}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Fetch projects
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FetchProgressView({ progress }: { progress: FetchProgress }) {
  const { completed, total, title } = progress;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-700">
        <span className="font-medium">
          {completed} of {total} done
        </span>
        <span className="text-slate-400">{remaining} left</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-600 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-violet-500" />
        {completed === 0
          ? "Researching first project…"
          : completed >= total
            ? "Finishing up…"
            : `Just finished “${title}”. Researching next…`}
      </div>
      <ul className="space-y-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <li
            key={i}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
              i < completed
                ? "bg-emerald-50 text-emerald-700"
                : i === completed
                  ? "bg-violet-50 text-violet-700"
                  : "text-slate-400"
            }`}
          >
            <span>
              {i < completed ? "✓" : i === completed ? "…" : "○"}
            </span>
            Project {i + 1}
            {i === completed && total > 0 && completed < total && " — in progress"}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500">{label}</label>
      {multiline ? (
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
