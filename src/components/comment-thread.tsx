"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

interface ActiveMention {
  start: number;
  end: number;
  query: string;
}

interface SelectedMention {
  userId: string;
  label: string;
}

interface MentionSegment {
  text: string;
  mention: boolean;
}

interface PickerPosition {
  left: number;
  top: number;
}

interface ComposerPiece {
  text: string;
  mention: boolean;
  isCaret?: boolean;
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

function getActiveMention(value: string, caret: number): ActiveMention | null {
  const uptoCaret = value.slice(0, caret);
  const atIndex = uptoCaret.lastIndexOf("@");
  if (atIndex === -1) return null;

  const previousChar = atIndex === 0 ? "" : value[atIndex - 1];
  if (previousChar && !/\s/.test(previousChar)) return null;

  const query = value.slice(atIndex + 1, caret);
  if (/\s/.test(query)) return null;

  return { start: atIndex, end: caret, query };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMentionSegments(body: string, mentionLabels: string[]): MentionSegment[] {
  if (mentionLabels.length === 0) return [{ text: body, mention: false }];

  const pattern = new RegExp(`(@(?:${mentionLabels.map(escapeRegExp).join("|")}))`, "g");
  const rawParts = body.split(pattern).filter((part) => part.length > 0);
  if (rawParts.length === 0) return [{ text: "", mention: false }];

  return rawParts.map((part) => ({
    text: part,
    mention: mentionLabels.some((label) => part === `@${label}`),
  }));
}

function buildComposerPieces(segments: MentionSegment[], caret: number): ComposerPiece[] {
  const pieces: ComposerPiece[] = [];
  let offset = 0;

  for (const segment of segments) {
    const segmentStart = offset;
    const segmentEnd = offset + segment.text.length;

    if (caret >= segmentStart && caret <= segmentEnd) {
      const splitIndex = caret - segmentStart;
      const before = segment.text.slice(0, splitIndex);
      const after = segment.text.slice(splitIndex);

      if (before) {
        pieces.push({ text: before, mention: segment.mention });
      }
      pieces.push({ text: "", mention: false, isCaret: true });
      if (after) {
        pieces.push({ text: after, mention: segment.mention });
      }
    } else {
      pieces.push({ text: segment.text, mention: segment.mention });
    }

    offset = segmentEnd;
  }

  if (pieces.every((piece) => !piece.isCaret)) {
    pieces.push({ text: "", mention: false, isCaret: true });
  }

  return pieces;
}

function renderBody(body: string, mentionedUserIds: string[], members: OrgMemberOption[]) {
  if (mentionedUserIds.length === 0) return body;
  const namesByUserId = new Map(members.map((m) => [m.userId, displayName(m)]));
  const mentionedNames = mentionedUserIds
    .map((id) => namesByUserId.get(id))
    .filter((n): n is string => Boolean(n));

  if (mentionedNames.length === 0) return body;

  return buildMentionSegments(body, mentionedNames).map((segment, i) => (
    <span
      key={`${segment.text}-${i}`}
      className={
        segment.mention
          ? "rounded bg-violet-100 px-1 py-0.5 font-medium text-violet-700"
          : undefined
      }
    >
      {segment.text}
    </span>
  ));
}

export function CommentThread({ entityType, entityId, className }: CommentThreadProps) {
  const { members } = useOrgMembers();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<SelectedMention[]>([]);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [caretIndex, setCaretIndex] = useState(0);
  const [pickerPosition, setPickerPosition] = useState<PickerPosition>({ left: 12, top: 36 });
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let cancelled = false;
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

  const availableMembers = useMemo(() => {
    const query = activeMention?.query.trim().toLowerCase() ?? "";
    return members.filter((member) => {
      if (selectedMentions.some((mention) => mention.userId === member.userId)) {
        return false;
      }

      if (!query) return true;

      const name = displayName(member).toLowerCase();
      const email = member.email?.toLowerCase() ?? "";
      return name.includes(query) || email.includes(query);
    });
  }, [activeMention?.query, members, selectedMentions]);

  const composerMentionLabels = useMemo(
    () =>
      selectedMentions
        .filter((mention) => text.includes(`@${mention.label}`))
        .map((mention) => mention.label),
    [selectedMentions, text],
  );

  const composerSegments = useMemo(
    () => buildMentionSegments(text, composerMentionLabels),
    [composerMentionLabels, text],
  );

  const composerPieces = useMemo(
    () => buildComposerPieces(composerSegments, caretIndex),
    [caretIndex, composerSegments],
  );

  useLayoutEffect(() => {
    if (!activeMention || !editorRef.current || !markerRef.current || !textareaRef.current) return;

    const marker = markerRef.current;
    const textarea = textareaRef.current;
    const editor = editorRef.current;
    const nextLeft = marker.offsetLeft - textarea.scrollLeft;
    const nextTop = marker.offsetTop - textarea.scrollTop + 24;
    const maxLeft = Math.max(12, editor.clientWidth - 272);

    setPickerPosition({
      left: Math.min(Math.max(12, nextLeft), maxLeft),
      top: Math.max(40, nextTop),
    });
  }, [activeMention, caretIndex, text]);

  function syncScroll() {
    if (!textareaRef.current || !overlayRef.current) return;
    overlayRef.current.scrollTop = textareaRef.current.scrollTop;
    overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }

  function syncSelection() {
    if (!textareaRef.current) return;
    const nextCaret = textareaRef.current.selectionStart ?? text.length;
    setCaretIndex(nextCaret);
    setActiveMention(getActiveMention(textareaRef.current.value, nextCaret));
  }

  function handleTextChange(value: string, caret: number) {
    setText(value);
    setSelectedMentions((prev) => prev.filter((mention) => value.includes(`@${mention.label}`)));
    setCaretIndex(caret);
    setActiveMention(getActiveMention(value, caret));
  }

  function pickMention(member: OrgMemberOption) {
    if (!activeMention) return;

    const label = displayName(member);
    const nextText = `${text.slice(0, activeMention.start)}@${label} ${text.slice(activeMention.end)}`;
    const nextCaretPosition = activeMention.start + label.length + 2;

    setText(nextText);
    setSelectedMentions((prev) =>
      prev.some((mention) => mention.userId === member.userId) ? prev : [...prev, { userId: member.userId, label }],
    );
    setCaretIndex(nextCaretPosition);
    setActiveMention(null);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition);
      syncScroll();
    });
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
        body: JSON.stringify({
          entityType,
          entityId,
          body,
          mentionedUserIds: selectedMentions.map((mention) => mention.userId),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error ?? "Could not post comment");
      }
      const { comment } = await res.json();
      setComments((prev) => [...prev, comment]);
      setText("");
      setSelectedMentions([]);
      setCaretIndex(0);
      setActiveMention(null);
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
        <div ref={editorRef} className="relative rounded-lg border border-slate-200 bg-white">
          <div
            ref={overlayRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-3 py-2 text-sm leading-5 text-slate-600"
          >
            {text ? (
              composerPieces.map((piece, index) =>
                piece.isCaret ? (
                  <span
                    key={`caret-${index}`}
                    ref={markerRef}
                    className={`inline-block h-5 w-px align-bottom ${
                      isComposerFocused ? "bg-slate-700" : "bg-transparent"
                    }`}
                  />
                ) : (
                  <span
                    key={`${piece.text}-${index}`}
                    className={
                      piece.mention
                        ? "rounded bg-violet-100 px-1 py-0.5 font-medium text-violet-700"
                        : undefined
                    }
                  >
                    {piece.text}
                  </span>
                ),
              )
            ) : (
              <span className="text-slate-400">Add a comment… type @ to mention someone</span>
            )}
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
            onClick={syncSelection}
            onFocus={() => setIsComposerFocused(true)}
            onBlur={() => setIsComposerFocused(false)}
            onKeyUp={syncSelection}
            onSelect={syncSelection}
            onScroll={syncScroll}
            placeholder="Add a comment… type @ to mention someone"
            rows={3}
            className="relative z-10 min-h-[76px] w-full resize-y rounded-lg bg-transparent px-3 py-2 text-sm leading-5 text-transparent caret-transparent outline-none placeholder:text-transparent"
          />
        </div>

        {activeMention && availableMembers.length > 0 && (
          <div
            className="absolute z-20 mt-1 w-64 rounded-lg border border-slate-100 bg-white p-1 shadow-lg"
            style={{ left: pickerPosition.left, top: pickerPosition.top }}
          >
            {availableMembers.map((m) => (
              <button
                key={m.userId}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(m)}
                className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-violet-50"
              >
                <span className="font-medium text-slate-700">{displayName(m)}</span>
                {m.email && <span className="ml-1 text-slate-400">{m.email}</span>}
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
