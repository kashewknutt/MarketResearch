"use client";

import type { LikeCount } from "@/lib/store/likes";

interface LikeCellProps {
  liked: LikeCount | undefined;
  onToggle: () => void;
}

/** Compact heart+count for a table row — stops the click from also triggering the row's onRowClick. */
export function LikeCell({ liked, onToggle }: LikeCellProps) {
  const count = liked?.count ?? 0;
  const likedByMe = liked?.likedByMe ?? false;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`rounded-md px-1.5 py-0.5 text-xs ${
        likedByMe ? "text-rose-600" : "text-slate-400 hover:text-slate-600"
      }`}
    >
      {likedByMe ? "♥" : "♡"} {count > 0 ? count : ""}
    </button>
  );
}
