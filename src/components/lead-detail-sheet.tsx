"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AssignTaskButton } from "@/components/assign-task-button";
import { LikeButton } from "@/components/like-button";
import { CommentThread } from "@/components/comment-thread";
import { CitationList } from "@/components/ui/citation-list";
import {
  PROJECT_LEAD_CATEGORY_COLORS,
  PROJECT_LEAD_CATEGORY_LABELS,
} from "@/lib/project-lead-labels";
import type { CallOutcome, LeadCallLog, LeadRecord, OutreachMessageDraft } from "@/lib/types/domain";

interface LeadDetailSheetProps {
  lead: LeadRecord | null;
  onClose: () => void;
}

const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  no_answer: "No answer",
  voicemail: "Voicemail",
  not_interested: "Not interested",
  interested: "Interested",
  callback_later: "Callback later",
  wrong_number: "Wrong number",
};

function CallLogSection({ leadId }: { leadId: string }) {
  const [logs, setLogs] = useState<LeadCallLog[]>([]);
  const [outcome, setOutcome] = useState<CallOutcome>("no_answer");
  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLogs([]);
    setNotes("");
    setLoaded(false);
    fetch(`/api/leads/${leadId}/call-logs`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs ?? []))
      .finally(() => setLoaded(true));
  }, [leadId]);

  async function logCall() {
    setLogging(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/call-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome, notes: notes.trim() || undefined }),
      });
      if (res.ok) {
        const { logs: updated } = await res.json();
        setLogs(updated ?? []);
        setNotes("");
      }
    } finally {
      setLogging(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-100 p-4">
      <p className="text-sm font-medium text-slate-800">Call log</p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium text-slate-500">Outcome</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as CallOutcome)}
            className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {Object.entries(CALL_OUTCOME_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={logCall}
          disabled={logging}
          className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
        >
          {logging ? "Logging…" : "Log call"}
        </button>
      </div>

      {loaded && logs.length > 0 && (
        <ul className="mt-3 space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
              <span className="font-medium text-slate-800">{CALL_OUTCOME_LABELS[log.outcome]}</span>
              {" · "}
              {new Date(log.calledAt).toLocaleString()}
              {log.notes && <p className="mt-1 whitespace-pre-wrap">{log.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Old records may still hold a plain string from before structured drafts — treat those as not-yet-drafted. */
function asDraft(value: LeadRecord["outreachMessage"]): OutreachMessageDraft | null {
  return value && typeof value === "object" ? value : null;
}

const EMPTY_DRAFT: OutreachMessageDraft = { subject: "", hookLine: "", body: "" };

function OutreachSection({ lead, onUpdate }: { lead: LeadRecord; onUpdate: (lead: LeadRecord) => void }) {
  const [findingContact, setFindingContact] = useState(false);
  const [contactNotFound, setContactNotFound] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [context, setContext] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<OutreachMessageDraft>(asDraft(lead.outreachMessage) ?? EMPTY_DRAFT);
  const [copied, setCopied] = useState(false);
  const [confirmingSent, setConfirmingSent] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(asDraft(lead.outreachMessage) ?? EMPTY_DRAFT);
    setManualUrl("");
    setContext("");
    setContactNotFound(false);
    setConfirmingSent(false);
  }, [lead.id]);

  const hasDraft = asDraft(lead.outreachMessage) !== null;
  const profileUrl = lead.contactLinkedInUrl || manualUrl;

  async function findContact() {
    setFindingContact(true);
    setError(null);
    setContactNotFound(false);
    try {
      const res = await fetch(`/api/leads/${lead.id}/find-contact`, { method: "POST" });
      if (!res.ok) throw new Error("Could not run the contact search");
      const { lead: updated, found } = await res.json();
      onUpdate(updated);
      if (!found) setContactNotFound(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run the contact search");
    } finally {
      setFindingContact(false);
    }
  }

  async function draftMessage() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/draft-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: context.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Could not draft a message");
      const { lead: updated } = await res.json();
      onUpdate(updated);
      setDraft(asDraft(updated.outreachMessage) ?? EMPTY_DRAFT);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft a message");
    } finally {
      setDrafting(false);
    }
  }

  async function copyMessage() {
    const composed = `Subject: ${draft.subject}\n\n${draft.hookLine}\n\n${draft.body}`;
    await navigator.clipboard.writeText(composed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function markSent() {
    setMarkingSent(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/mark-sent`, { method: "POST" });
      if (!res.ok) throw new Error("Could not mark this as sent");
      const { lead: updated } = await res.json();
      onUpdate(updated);
      setConfirmingSent(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark this as sent");
    } finally {
      setMarkingSent(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-100 p-4">
      <p className="text-sm font-medium text-slate-800">Outreach</p>

      <div className="mt-3 space-y-3">
        <div>
          <button
            type="button"
            onClick={findContact}
            disabled={findingContact}
            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
          >
            {findingContact ? "Searching…" : "Find contact"}
          </button>

          {lead.contactName ? (
            <div className="mt-2 rounded-lg bg-slate-50 p-3 text-xs">
              <p className="font-medium text-slate-700">
                {lead.contactName}
                {lead.contactTitle && <span className="font-normal text-slate-500"> · {lead.contactTitle}</span>}
              </p>
              {lead.contactLinkedInUrl && (
                <a
                  href={lead.contactLinkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-violet-700 hover:underline"
                >
                  View LinkedIn profile
                </a>
              )}
            </div>
          ) : contactNotFound ? (
            <p className="mt-2 text-xs text-slate-500">
              No public decision-maker profile found — you can look one up manually below.
            </p>
          ) : null}

          {!lead.contactLinkedInUrl && (
            <label className="mt-2 block text-xs font-medium text-slate-500">
              Paste a LinkedIn profile URL manually
              <input
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/…"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </label>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500">
            Context (optional) — who you&apos;re writing to, recent news, role, etc.
          </label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={2}
            placeholder="e.g. Writing to their VP of Ops, who recently posted about supply chain delays"
            className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          />

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={draftMessage}
              disabled={drafting}
              className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              {drafting ? "Drafting…" : hasDraft ? "Regenerate" : "Draft message"}
            </button>
            {profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                Open LinkedIn profile
              </a>
            )}
          </div>

          {hasDraft && (
            <div className="mt-2 space-y-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Subject</label>
                <input
                  value={draft.subject}
                  onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Hook line</label>
                <input
                  value={draft.hookLine}
                  onChange={(e) => setDraft((d) => ({ ...d, hookLine: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Body</label>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyMessage}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                >
                  {copied ? "Copied" : "Copy message"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div>
          {confirmingSent ? (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
              <p>
                This only records that <em>you</em> sent this message yourself on LinkedIn — there is no way to
                verify an actual send.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={markSent}
                  disabled={markingSent}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {markingSent ? "Saving…" : "Confirm, I sent it"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingSent(false)}
                  className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingSent(true)}
              disabled={lead.outreachStatus === "sent"}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            >
              {lead.outreachStatus === "sent" ? "Marked as sent" : "Mark as sent"}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-rose-700">{error}</p>}
      </div>
    </section>
  );
}

export function LeadDetailSheet({ lead, onClose }: LeadDetailSheetProps) {
  const router = useRouter();
  const [current, setCurrent] = useState<LeadRecord | null>(lead);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);

  useEffect(() => {
    setCurrent(lead);
  }, [lead]);

  if (!current) return null;

  const copyOpeningMessage = async (index: number, msg: OutreachMessageDraft) => {
    await navigator.clipboard.writeText(`Subject: ${msg.subject}\n\n${msg.hookLine}\n\n${msg.body}`);
    setCopiedMessageIndex(index);
    setTimeout(() => setCopiedMessageIndex(null), 1500);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">{current.company}</h2>
        <div className="flex items-center gap-2">
          <LikeButton entityType="lead" entityId={current.id} />
          <AssignTaskButton
            entityType="lead"
            entityId={current.id}
            defaultTitle={`Follow up: ${current.company}`}
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-block rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
            {current.region} · Fit {current.fitScore}
          </span>
          {current.source === "project" && (
            <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
              Project lead
            </span>
          )}
          {current.source === "cold_call" && (
            <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
              Cold call
            </span>
          )}
          {current.projectLeadCategory && (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs ${PROJECT_LEAD_CATEGORY_COLORS[current.projectLeadCategory]}`}
            >
              {PROJECT_LEAD_CATEGORY_LABELS[current.projectLeadCategory]}
            </span>
          )}
        </div>

        {(current.companyPhone || current.companyAddress) && (
          <section className="rounded-lg border border-slate-100 p-3 text-xs text-slate-700">
            {current.companyPhone && (
              <p>
                <a href={`tel:${current.companyPhone}`} className="font-medium text-violet-700 hover:underline">
                  {current.companyPhone}
                </a>
              </p>
            )}
            {current.companyAddress && <p className="mt-1 text-slate-500">{current.companyAddress}</p>}
            {!current.companyWebsite && current.source === "cold_call" && (
              <p className="mt-1 text-slate-400">No website found — cold-call candidate.</p>
            )}
          </section>
        )}

        {current.projectTitle && current.projectId && (
          <section className="rounded-lg border border-slate-100 p-3">
            <p className="text-xs font-medium text-slate-500">Linked project</p>
            <button
              type="button"
              onClick={() => {
                fetch(`/api/projects?id=${current.projectId}`)
                  .then((r) => r.json())
                  .then((d) => {
                    if (d.project) {
                      window.dispatchEvent(
                        new CustomEvent("open-project", { detail: d.project }),
                      );
                    } else {
                      router.push("/projects");
                    }
                  })
                  .catch(() => router.push("/projects"));
              }}
              className="mt-1 text-sm font-medium text-violet-700 hover:underline"
            >
              {current.projectTitle}
            </button>
          </section>
        )}

        {(current.whyPerfect || current.whyFit) && (
          <section className="rounded-lg bg-violet-50/40 p-4">
            <p className="text-sm font-medium text-slate-800">Why this lead is perfect</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-700">
              {current.whyPerfect || current.whyFit}
            </p>
          </section>
        )}

        {current.contactPlan && (
          <section>
            <p className="text-sm font-medium text-slate-800">How to contact</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{current.contactPlan}</p>
            {current.contactHints && (
              <p className="mt-2 text-xs text-slate-500">
                <strong className="text-slate-600">Hints:</strong> {current.contactHints}
              </p>
            )}
          </section>
        )}

        {current.pitchOutline && (
          <section>
            <p className="text-sm font-medium text-slate-800">What to pitch</p>
            <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{current.pitchOutline}</p>
          </section>
        )}

        {current.signals.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Signals</p>
            <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
              {current.signals.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
        )}

        {current.objections && current.objections.length > 0 && (
          <section>
            <p className="text-sm font-medium text-slate-800">Likely objections</p>
            <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
              {current.objections.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <p className="text-sm font-medium text-slate-800">Citations</p>
          <CitationList citations={current.sources} />
        </section>

        {current.openingMessages && current.openingMessages.length > 0 && (
          <section className="rounded-lg border border-slate-100 p-4">
            <p className="text-sm font-medium text-slate-800">Opening messages</p>
            <p className="mt-1 text-xs text-slate-500">
              AI-generated options grounded in this project and lead category.
            </p>
            <div className="mt-3 space-y-3">
              {current.openingMessages.map((msg, i) => (
                <div key={i} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  <p className="font-medium text-slate-800">{msg.subject}</p>
                  <p className="mt-1 italic text-slate-500">{msg.hookLine}</p>
                  <p className="mt-1 whitespace-pre-wrap">{msg.body}</p>
                  <button
                    type="button"
                    onClick={() => void copyOpeningMessage(i, msg)}
                    className="mt-2 text-violet-700 hover:underline"
                  >
                    {copiedMessageIndex === i ? "Copied" : "Copy message"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <OutreachSection lead={current} onUpdate={setCurrent} />

        <CallLogSection leadId={current.id} />

        <CommentThread entityType="lead" entityId={current.id} />
      </div>
    </div>
  );
}
