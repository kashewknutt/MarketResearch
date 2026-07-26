"use client";

import { useState } from "react";
import type { MarketProject } from "@/lib/types/domain";

interface FetchProjectsFormProps {
  regions: string[];
  onClose: () => void;
  onFetched: (projects: MarketProject[]) => void;
}

const CUSTOM_REGION_VALUE = "__custom__";

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

  const numericCount = Number(count);
  const canSubmit = region.trim() && Number.isFinite(numericCount) && numericCount >= 1 && numericCount <= 50;

  const submit = async () => {
    setError(null);
    setSaving(true);

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
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.message ?? data.error ?? "Could not fetch projects.");
      return;
    }

    onFetched(data.projects as MarketProject[]);
  };

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-end bg-black/20">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Fetch projects</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Run the AI research pipeline for a region and pull in as many new opportunities
          as you want, without waiting for existing ones to be marked done.
        </p>

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
            <label className="text-xs font-medium text-slate-500">Number of projects</label>
            <input
              type="number"
              min={1}
              max={50}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={count}
              onChange={(e) => setCount(e.target.value)}
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
            disabled={!canSubmit || saving}
            onClick={submit}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Fetching…" : "Fetch projects"}
          </button>
        </div>
      </div>
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
