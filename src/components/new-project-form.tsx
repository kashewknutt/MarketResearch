"use client";

import { useState } from "react";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import type { MarketProject } from "@/lib/types/domain";

interface NewProjectFormProps {
  regions: string[];
  onClose: () => void;
  onCreated: (project: MarketProject) => void;
}

interface FormState {
  region: string;
  title: string;
  summary: string;
  explanation: string;
  rationale: string;
  ticketSize: string;
  currency: string;
  effort: "low" | "medium" | "high";
  expectedValue: string;
  nextStep: string;
}

const EMPTY_FORM = (regions: string[]): FormState => ({
  region: regions[0] ?? "US",
  title: "",
  summary: "",
  explanation: "",
  rationale: "",
  ticketSize: "",
  currency: DEFAULT_CURRENCY,
  effort: "medium",
  expectedValue: "",
  nextStep: "",
});

export function NewProjectForm({ regions, onClose, onCreated }: NewProjectFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM(regions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setError(null);
    setSaving(true);

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        ticketSize: Number(form.ticketSize),
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save this project.");
      return;
    }

    onCreated(data.project as MarketProject);
  };

  const canSubmit =
    form.region.trim() &&
    form.title.trim() &&
    form.summary.trim() &&
    form.explanation.trim() &&
    form.expectedValue.trim() &&
    form.nextStep.trim() &&
    Number(form.ticketSize) >= 0 &&
    form.ticketSize.trim() !== "";

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-end bg-black/20">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">New project</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Add an opportunity you&apos;ve already identified. You can generate context
          and leads for it once it&apos;s saved.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Region" value={form.region} onChange={(v) => update("region", v)} />
          <Field label="Title" value={form.title} onChange={(v) => update("title", v)} />
          <Field
            label="Summary"
            value={form.summary}
            onChange={(v) => update("summary", v)}
            multiline
          />
          <Field
            label="Explanation"
            value={form.explanation}
            onChange={(v) => update("explanation", v)}
            multiline
          />
          <Field
            label="Rationale (optional)"
            value={form.rationale}
            onChange={(v) => update("rationale", v)}
            multiline
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Ticket size"
              type="number"
              value={form.ticketSize}
              onChange={(v) => update("ticketSize", v)}
            />
            <Field
              label="Currency"
              value={form.currency}
              onChange={(v) => update("currency", v)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Effort</label>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={form.effort}
              onChange={(e) => update("effort", e.target.value as FormState["effort"])}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <Field
            label="Expected value"
            value={form.expectedValue}
            onChange={(v) => update("expectedValue", v)}
            placeholder="e.g. $5k-$10k MRR within 6 months"
          />
          <Field
            label="Next step"
            value={form.nextStep}
            onChange={(v) => update("nextStep", v)}
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
            {saving ? "Saving…" : "Save project"}
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
  type = "text",
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
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
          rows={3}
        />
      ) : (
        <input
          type={type}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
