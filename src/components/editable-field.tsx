"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";

interface EditableFieldProps {
  label: string;
  value: string | number;
  onSave: (value: string | number) => Promise<void>;
  type?: "text" | "number" | "textarea";
  prefix?: string;
  provenance?: "ai" | "user" | "search";
}

export function EditableField({
  label,
  value,
  onSave,
  type = "text",
  prefix,
  provenance,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const parsed =
      type === "number" ? Number(draft) : draft;
    await onSave(parsed);
    setSaving(false);
    setEditing(false);
  };

  return (
    <div className="group rounded-lg border border-slate-100 bg-white p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {provenance && (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              provenance === "user" && "bg-violet-100 text-violet-700",
              provenance === "ai" && "bg-sky-100 text-sky-700",
              provenance === "search" && "bg-emerald-100 text-emerald-700",
            )}
          >
            {provenance === "user" ? "Edited" : provenance === "search" ? "Search" : "AI"}
          </span>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          {type === "textarea" ? (
            <textarea
              className="min-h-[80px] w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : (
            <input
              type={type === "number" ? "number" : "text"}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-slate-800 px-3 py-1 text-xs text-white hover:bg-slate-700"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(String(value));
                setEditing(false);
              }}
              className="rounded-md border border-slate-200 px-3 py-1 text-xs text-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full text-left text-sm text-slate-800 hover:text-slate-600"
        >
          {prefix}
          {value}
        </button>
      )}
    </div>
  );
}
