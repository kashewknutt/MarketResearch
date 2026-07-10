"use client";

import { useState } from "react";
import { useOrgMembers } from "@/lib/hooks/use-org-members";
import type { AssignmentEntityType } from "@/lib/store/assignments";

interface AssignTaskButtonProps {
  entityType: AssignmentEntityType;
  entityId: string | null;
  defaultTitle: string;
  className?: string;
}

export function AssignTaskButton({
  entityType,
  entityId,
  defaultTitle,
  className,
}: AssignTaskButtonProps) {
  const { role, members } = useOrgMembers();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [notes, setNotes] = useState("");
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (role !== "owner") return null;

  async function submit() {
    if (!assigneeUserId || !title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, assigneeUserId, title, notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not assign this task");
      }
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setNotes("");
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign this task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`relative inline-block ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
      >
        Assign
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-slate-100 bg-white p-4 shadow-lg">
          {done ? (
            <p className="text-sm text-emerald-700">Assigned.</p>
          ) : (
            <>
              <label className="block text-xs font-medium text-slate-500">
                Title
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>

              <label className="mt-3 block text-xs font-medium text-slate-500">
                Assign to
                <select
                  value={assigneeUserId}
                  onChange={(e) => setAssigneeUserId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="">Select a team member</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.fullName ?? m.email ?? m.userId}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-3 block text-xs font-medium text-slate-500">
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </label>

              {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting || !assigneeUserId || !title.trim()}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {submitting ? "Assigning…" : "Assign"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
