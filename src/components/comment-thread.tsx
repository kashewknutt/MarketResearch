"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOrgMembers, type OrgMemberOption } from "@/lib/hooks/use-org-members";
import type { AssignmentEntityType } from "@/lib/store/assignments";

interface CommentAuthor {
  userId: string;
  fullName: string | null;
  email: string | null;
}

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  author: CommentAuthor;
  mentionedUserIds: string[];
}

interface CommentThreadProps {
  entityType: AssignmentEntityType;
  entityId: string;
  className?: string;
}

function displayName(person: { fullName?: string | null; email?: string | null; userId?: string }): string {
  return person.fullName ?? person.email ?? person.userId ?? "Unknown";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function renderBody(body: string, mentionedUserIds: string[], members: OrgMemberOption[]) {
  if (mentionedUserIds.length === 0) return body;
  const namesByUserId = new Map(members.map((m) => [m.userId, displayName(m)]));
  const mentionedNames = mentionedUserIds
    .map((id) => namesByUserId.get(id))
    .filter((n): n is string => Boolean(n));

  if (mentionedNames.length === 0) return body;

  const pattern = new RegExp(`(@(?:${mentionedNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  const parts = body.split(pattern);
  return parts.map((part, i) =>
    mentionedNames.some((n) => part === `@${n}`) ? (
      <span key={i} className="font-medium text-violet-700">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function CommentThread({ entityType, entityId, className }: CommentThreadProps) {
  const { members } = useOrgMembers();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/comments?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setComments(body.comments ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  const availableMembers = useMemo(
    () => members.filter((m) => !mentionedUserIds.includes(m.userId)),
    [members, mentionedUserIds],
  );

  function handleTextChange(value: string) {
    setText(value);
    setShowPicker(value.endsWith("@"));
  }

  function pickMention(member: OrgMemberOption) {
    setText((prev) => `${prev.slice(0, -1)}@${displayName(member)} `);
    setMentionedUserIds((prev) => [...prev, member.userId]);
    setShowPicker(false);
    textareaRef.current?.focus();
  }

  async function submit() {
    const body = text.trim();
    if (!body) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId, body, mentionedUserIds }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Could not post comment");
      }
      const { comment } = await res.json();
      setComments((prev) => [...prev, comment]);
      setText("");
      setMentionedUserIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post comment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-slate-700">Comments</h3>

      <div className="mt-3 space-y-3">
        {loading ? (
          <p className="text-xs text-slate-400">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-slate-400">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-700">{displayName(c.author)}</span>
                <span className="text-[11px] text-slate-400">{relativeTime(c.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {renderBody(c.body, c.mentionedUserIds, members)}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="relative mt-3">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Add a comment… type @ to mention someone"
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />

        {showPicker && availableMembers.length > 0 && (
          <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-100 bg-white p-1 shadow-lg">
            {availableMembers.map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => pickMention(m)}
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-violet-50"
              >
                {displayName(m)}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-1 text-xs text-rose-700">{error}</p>}

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !text.trim()}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
