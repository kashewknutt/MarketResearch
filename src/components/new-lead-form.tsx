"use client";

import { useState } from "react";
import type { LeadRecord, LeadStatus } from "@/lib/types/domain";

interface NewLeadFormProps {
  onClose: () => void;
  onCreated: (lead: LeadRecord) => void;
}

interface FormState {
  company: string;
  region: string;
  fitScore: string;
  whyFit: string;
  contactHints: string;
  contactName: string;
  contactTitle: string;
  contactLinkedInUrl: string;
  status: LeadStatus;
}

const EMPTY_FORM: FormState = {
  company: "",
  region: "US",
  fitScore: "50",
  whyFit: "",
  contactHints: "",
  contactName: "",
  contactTitle: "",
  contactLinkedInUrl: "",
  status: "new",
};

export function NewLeadForm({ onClose, onCreated }: NewLeadFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    setError(null);
    setSaving(true);

    const res = await fetch("/api/leads/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        fitScore: Number(form.fitScore),
      }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError(data.error ?? "Could not save this lead.");
      return;
    }

    onCreated(data.lead as LeadRecord);
  };

  const canSubmit =
    form.company.trim() &&
    form.region.trim() &&
    form.whyFit.trim() &&
    form.fitScore.trim() !== "" &&
    Number(form.fitScore) >= 0 &&
    Number(form.fitScore) <= 100;

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-end bg-black/20">
      <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">New lead</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Add a prospect you&apos;ve already identified. You can find their contact
          and draft outreach once it&apos;s saved.
        </p>

        <div className="mt-6 space-y-4">
          <Field label="Company" value={form.company} onChange={(v) => update("company", v)} />
          <Field label="Region" value={form.region} onChange={(v) => update("region", v)} />
          <Field
            label="Why they're a fit"
            value={form.whyFit}
            onChange={(v) => update("whyFit", v)}
            multiline
          />
          <Field
            label="Contact hints"
            value={form.contactHints}
            onChange={(v) => update("contactHints", v)}
            placeholder="e.g. reach out via LinkedIn, mention their recent funding round"
            multiline
          />
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Fit score (0-100)"
              type="number"
              value={form.fitScore}
              onChange={(v) => update("fitScore", v)}
            />
            <div>
              <label className="text-xs font-medium text-slate-500">Status</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={form.status}
                onChange={(e) => update("status", e.target.value as LeadStatus)}
              >
                <option value="new">New</option>
                <option value="qualified">Qualified</option>
                <option value="contacted">Contacted</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <Field
            label="Contact name (optional)"
            value={form.contactName}
            onChange={(v) => update("contactName", v)}
          />
          <Field
            label="Contact title (optional)"
            value={form.contactTitle}
            onChange={(v) => update("contactTitle", v)}
          />
          <Field
            label="Contact LinkedIn URL (optional)"
            value={form.contactLinkedInUrl}
            onChange={(v) => update("contactLinkedInUrl", v)}
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
            {saving ? "Saving…" : "Save lead"}
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
