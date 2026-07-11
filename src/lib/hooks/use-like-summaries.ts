"use client";

import { useCallback, useEffect, useState } from "react";
import type { LikeCount, LikeEntityType } from "@/lib/store/likes";

/** Batch like counts/likedByMe for a set of table rows, plus a toggle helper for the row's own like button. */
export function useLikeSummaries(entityType: LikeEntityType, entityIds: string[]) {
  const [likes, setLikes] = useState<Record<string, LikeCount>>({});
  const idsKey = entityIds.join(",");

  const load = useCallback(() => {
    if (entityIds.length === 0) {
      setLikes({});
      return;
    }
    fetch("/api/likes/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType, entityIds }),
    })
      .then((r) => r.json())
      .then((d) => setLikes(d.summaries ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, idsKey]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    async (entityId: string) => {
      setLikes((prev) => {
        const current = prev[entityId] ?? { count: 0, likedByMe: false };
        return {
          ...prev,
          [entityId]: {
            count: current.likedByMe ? current.count - 1 : current.count + 1,
            likedByMe: !current.likedByMe,
          },
        };
      });
      try {
        const res = await fetch("/api/likes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType, entityId }),
        });
        const data = await res.json();
        setLikes((prev) => ({
          ...prev,
          [entityId]: { count: data.count, likedByMe: data.likedByMe },
        }));
      } catch {
        load();
      }
    },
    [entityType, load],
  );

  return { likes, toggle };
}
