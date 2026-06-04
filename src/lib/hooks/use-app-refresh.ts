"use client";

import { useEffect } from "react";

/** Re-run `reload` when navbar refresh completes for this page (or full research). */
export function useAppRefresh(
  reload: () => void,
  sections: string[],
) {
  useEffect(() => {
    const handler = (e: Event) => {
      const section = (e as CustomEvent<{ section: string }>).detail?.section;
      if (!section) return;
      if (section === "all" || sections.includes(section)) {
        reload();
      }
    };
    window.addEventListener("app-data-refreshed", handler);
    return () => window.removeEventListener("app-data-refreshed", handler);
  }, [reload, sections]);
}

export function emitAppDataRefreshed(section: string) {
  window.dispatchEvent(
    new CustomEvent("app-data-refreshed", { detail: { section } }),
  );
}
