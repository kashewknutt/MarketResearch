"use client";

import { useEffect, useState } from "react";
import type { LikeEntityType, LikeSummary } from "@/lib/store/likes";

interface LikeButtonProps {
  entityType: LikeEntityType;
  entityId: string | null;
  className?: string;
}

const EMPTY_SUMMARY: LikeSummary = { count: 0, likedByMe: false, likedBy: [] };

export function LikeButton({ entityType, entityId, className }: LikeButtonProps) {
  const [summary, setSummary] = useState<LikeSummary>(EMPTY_SUMMARY);
  const [showNames, setShowNames] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    fetch(`/api/likes?entityType=${entityType}&entityId=${encodeURIComponent(entityId)}`)
      .then((r) => r.json())
      .then((d: LikeSummary) => setSummary(d));
  }, [entityType, entityId]);

  if (!entityId) return null;

  async function toggle() {
    if (loading) return;
    setLoading(true);
    const previous = summary;
    setSummary((s) => ({
      count: s.likedByMe ? s.count - 1 : s.count + 1,
      likedByMe: !s.likedByMe,
      likedBy: s.likedBy,
    }));
    try {
      const res = await fetch("/api/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType, entityId }),
      });
      const data: LikeSummary = await res.json();
      setSummary(data);
    } catch {
      setSummary(previous);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`relative inline-flex items-center gap-1 ${className ?? ""}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium disabled:opacity-50 ${
          summary.likedByMe
            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
        }`}
      >
        {summary.likedByMe ? "♥" : "♡"} {summary.count > 0 ? summary.count : ""}
      </button>

      {summary.count > 0 && (
        <button
          type="button"
          onClick={() => setShowNames((v) => !v)}
          className="text-xs text-slate-400 underline decoration-dotted hover:text-slate-600"
        >
          who?
        </button>
      )}

      {showNames && (
        <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-slate-100 bg-white p-3 shadow-lg">
          <p className="text-xs font-medium text-slate-500">Liked by</p>
          <ul className="mt-1.5 space-y-1">
            {summary.likedBy.map((p) => (
              <li key={p.userId} className="text-xs text-slate-700">
                {p.fullName ?? p.email ?? p.userId}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
