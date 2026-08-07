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
import type {
  CallOutcome,
  ContactStatus,
  LeadCallLog,
  LeadRecord,
  OutreachMessageDraft,
} from "@/lib/types/domain";

interface LeadDetailSheetProps {
  lead: LeadRecord | null;
  onClose: () => void;
}

/** Figma-inspector-style collapsible row: uppercase label, chevron, hairline divider — used for every group in this panel so the sidebar reads as one consistent stack instead of a pile of separately-boxed cards. */
function PanelSection({
  title,
  badge,
  defaultOpen = true,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-100 py-3 first:pt-0 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </span>
        <span className="flex items-center gap-2">
          {badge}
          <svg
            viewBox="0 0 12 12"
            className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
          >
            <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && <div className="mt-2.5">{children}</div>}
    </div>
  );
}

/** Compact label used inside a PanelSection for a sub-field (e.g. "Subject" within Outreach). */
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-medium text-slate-400">{children}</label>;
}

const fieldClass =
  "w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-violet-300 focus:outline-none";
const primaryButtonClass =
  "rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50";
const ghostButtonClass =
  "rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50";

const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  no_answer: "No answer",
  voicemail: "Voicemail",
  not_interested: "Not interested",
  interested: "Interested",
  callback_later: "Callback later",
  wrong_number: "Wrong number",
};

const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  not_contacted: "Not contacted",
  waiting_for_reply: "Waiting for reply",
  in_contact: "In contact",
  rejected: "Rejected",
};

function ContactStatusSection({
  lead,
  onUpdate,
}: {
  lead: LeadRecord;
  onUpdate: (lead: LeadRecord) => void;
}) {
  const [status, setStatus] = useState<ContactStatus>(lead.contactStatus ?? "not_contacted");
  const [remarks, setRemarks] = useState(lead.contactRemarks ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStatus(lead.contactStatus ?? "not_contacted");
    setRemarks(lead.contactRemarks ?? "");
    setSaved(false);
  }, [lead.id]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactStatus: status, contactRemarks: remarks.trim() || undefined }),
      });
      if (res.ok) {
        const { lead: updated } = await res.json();
        onUpdate(updated);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <PanelSection title="Contact status">
      <div className="space-y-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ContactStatus)}
          className={`${fieldClass} bg-white`}
        >
          {Object.entries(CONTACT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Remarks — why rejected, what's going on, etc. (optional)"
          rows={2}
          className={fieldClass}
        />
        <button type="button" onClick={save} disabled={saving} className={primaryButtonClass}>
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
      </div>
    </PanelSection>
  );
}

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
    <PanelSection title="Call log" badge={logs.length > 0 ? <span className="text-[11px] text-slate-400">{logs.length}</span> : undefined}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as CallOutcome)}
            className={`${fieldClass} w-auto bg-white`}
          >
            {Object.entries(CALL_OUTCOME_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className={`${fieldClass} min-w-[8rem] flex-1`}
          />
          <button type="button" onClick={logCall} disabled={logging} className={primaryButtonClass}>
            {logging ? "Logging…" : "Log call"}
          </button>
        </div>

        {loaded && logs.length > 0 && (
          <ul className="space-y-1.5">
            {logs.map((log) => (
              <li key={log.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                <span className="font-medium text-slate-800">{CALL_OUTCOME_LABELS[log.outcome]}</span>
                {" · "}
                {new Date(log.calledAt).toLocaleString()}
                {log.notes && <p className="mt-1 whitespace-pre-wrap">{log.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PanelSection>
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
    <PanelSection title="Outreach">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={findContact} disabled={findingContact} className={primaryButtonClass}>
              {findingContact ? "Searching…" : "Find contact"}
            </button>
          </div>

          {lead.contactName ? (
            <div className="rounded-md bg-slate-50 p-2.5 text-xs">
              <p className="text-[11px] text-slate-400">
                Likely decision-maker at this company (found via LinkedIn, by company name) — not
                verified as who actually answers the phone line above.
              </p>
              <p className="mt-1 font-medium text-slate-700">
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
            <p className="text-xs text-slate-500">
              No public decision-maker profile found — you can look one up manually below.
            </p>
          ) : null}

          {!lead.contactLinkedInUrl && (
            <div>
              <FieldLabel>Paste a LinkedIn profile URL manually</FieldLabel>
              <input
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/…"
                className={`${fieldClass} mt-1`}
              />
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-50 pt-3">
          <div>
            <FieldLabel>Context (optional) — who you&apos;re writing to, recent news, role, etc.</FieldLabel>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={2}
              placeholder="e.g. Writing to their VP of Ops, who recently posted about supply chain delays"
              className={`${fieldClass} mt-1`}
            />
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={draftMessage} disabled={drafting} className={primaryButtonClass}>
              {drafting ? "Drafting…" : hasDraft ? "Regenerate" : "Draft message"}
            </button>
            {profileUrl && (
              <a href={profileUrl} target="_blank" rel="noopener noreferrer" className={ghostButtonClass}>
                Open LinkedIn profile
              </a>
            )}
          </div>

          {hasDraft && (
            <div className="space-y-2">
              <div>
                <FieldLabel>Subject</FieldLabel>
                <input
                  value={draft.subject}
                  onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
                  className={`${fieldClass} mt-1`}
                />
              </div>
              <div>
                <FieldLabel>Hook line</FieldLabel>
                <input
                  value={draft.hookLine}
                  onChange={(e) => setDraft((d) => ({ ...d, hookLine: e.target.value }))}
                  className={`${fieldClass} mt-1`}
                />
              </div>
              <div>
                <FieldLabel>Body</FieldLabel>
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  rows={4}
                  className={`${fieldClass} mt-1`}
                />
              </div>
              <button type="button" onClick={copyMessage} className={ghostButtonClass}>
                {copied ? "Copied" : "Copy message"}
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-slate-50 pt-3">
          {confirmingSent ? (
            <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800">
              <p>
                This only records that <em>you</em> sent this message yourself on LinkedIn — there is no way to
                verify an actual send.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={markSent}
                  disabled={markingSent}
                  className="rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {markingSent ? "Saving…" : "Confirm, I sent it"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingSent(false)}
                  className="rounded-md px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100"
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
              className={ghostButtonClass}
            >
              {lead.outreachStatus === "sent" ? "Marked as sent" : "Mark as sent"}
            </button>
          )}
        </div>

        {error && <p className="text-xs text-rose-700">{error}</p>}
      </div>
    </PanelSection>
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

  const hasDetails = current.companyPhone || current.companyAddress || (current.projectTitle && current.projectId);
  const hasInsights =
    current.whyPerfect ||
    current.whyFit ||
    current.painPoint ||
    current.contactPlan ||
    current.pitchOutline ||
    current.signals.length > 0 ||
    (current.objections && current.objections.length > 0);

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-slate-100 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-800">{current.company}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-block rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700">
              {current.region} · Fit {current.fitScore}
            </span>
            {current.source === "project" && (
              <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[11px] text-sky-700">
                Project lead
              </span>
            )}
            {current.source === "cold_call" && (
              <span className="inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                Cold call
              </span>
            )}
            {current.projectLeadCategory && (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[11px] ${PROJECT_LEAD_CATEGORY_COLORS[current.projectLeadCategory]}`}
              >
                {PROJECT_LEAD_CATEGORY_LABELS[current.projectLeadCategory]}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 pl-3">
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

      <div className="flex-1 overflow-y-auto px-5">
        {hasDetails && (
          <PanelSection title="Details">
            <div className="space-y-2 text-xs text-slate-700">
              {current.companyPhone && (
                <p>
                  <a href={`tel:${current.companyPhone}`} className="font-medium text-violet-700 hover:underline">
                    {current.companyPhone}
                  </a>
                </p>
              )}
              {current.companyAddress && <p className="text-slate-500">{current.companyAddress}</p>}
              {current.googleRating != null && (
                <p className="text-slate-500">
                  ★ {current.googleRating.toFixed(1)}
                  {current.googleReviewCount != null && ` (${current.googleReviewCount} reviews)`}
                </p>
              )}
              {current.openingHours && (
                <p className="whitespace-pre-wrap text-slate-500">
                  {current.openingHours.split("; ").join("\n")}
                </p>
              )}
              {!current.companyWebsite && current.source === "cold_call" && (
                <p className="text-slate-400">No website found — cold-call candidate.</p>
              )}
              {current.projectTitle && current.projectId && (
                <div className="border-t border-slate-50 pt-2">
                  <FieldLabel>Linked project</FieldLabel>
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`/api/projects?id=${current.projectId}`)
                        .then((r) => r.json())
                        .then((d) => {
                          if (d.project) {
                            window.dispatchEvent(new CustomEvent("open-project", { detail: d.project }));
                          } else {
                            router.push("/projects");
                          }
                        })
                        .catch(() => router.push("/projects"));
                    }}
                    className="mt-0.5 block text-sm font-medium text-violet-700 hover:underline"
                  >
                    {current.projectTitle}
                  </button>
                </div>
              )}
            </div>
          </PanelSection>
        )}

        {hasInsights && (
          <PanelSection title="Insights">
            <div className="space-y-3">
              {(current.whyPerfect || current.whyFit) && (
                <div>
                  <FieldLabel>Why this lead is perfect</FieldLabel>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
                    {current.whyPerfect || current.whyFit}
                  </p>
                </div>
              )}

              {current.painPoint && (
                <div>
                  <FieldLabel>Likely pain point</FieldLabel>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{current.painPoint}</p>
                </div>
              )}

              {current.pitchOutline && (
                <div>
                  <FieldLabel>What to pitch</FieldLabel>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">{current.pitchOutline}</p>
                </div>
              )}

              {current.contactPlan && (
                <div>
                  <FieldLabel>How to contact</FieldLabel>
                  <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-600">{current.contactPlan}</p>
                  {current.contactHints && (
                    <p className="mt-1 text-xs text-slate-500">
                      <strong className="text-slate-600">Hints:</strong> {current.contactHints}
                    </p>
                  )}
                </div>
              )}

              {current.signals.length > 0 && (
                <div>
                  <FieldLabel>Signals</FieldLabel>
                  <ul className="mt-0.5 list-inside list-disc text-xs text-slate-600">
                    {current.signals.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {current.objections && current.objections.length > 0 && (
                <div>
                  <FieldLabel>Likely objections</FieldLabel>
                  <ul className="mt-0.5 list-inside list-disc text-xs text-slate-600">
                    {current.objections.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </PanelSection>
        )}

        <PanelSection
          title="Sources"
          defaultOpen={false}
          badge={<span className="text-[11px] text-slate-400">{current.sources.length}</span>}
        >
          <CitationList citations={current.sources} />
        </PanelSection>

        {current.openingMessages && current.openingMessages.length > 0 && (
          <PanelSection
            title="Opening messages"
            defaultOpen={false}
            badge={<span className="text-[11px] text-slate-400">{current.openingMessages.length}</span>}
          >
            <p className="mb-2 text-xs text-slate-500">
              AI-generated options grounded in this project and lead category.
            </p>
            <div className="space-y-2.5">
              {current.openingMessages.map((msg, i) => (
                <div key={i} className="rounded-md bg-slate-50 p-2.5 text-xs text-slate-700">
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
          </PanelSection>
        )}

        <OutreachSection lead={current} onUpdate={setCurrent} />

        <ContactStatusSection lead={current} onUpdate={setCurrent} />

        <CallLogSection leadId={current.id} />

        <div className="py-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Comments</span>
          <div className="mt-2.5">
            <CommentThread entityType="lead" entityId={current.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
