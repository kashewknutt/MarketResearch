"use client";

import { cn } from "@/lib/utils/cn";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-px">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-t-lg px-4 py-2 text-sm transition-colors",
            active === t.id
              ? "bg-white font-medium text-violet-800 shadow-sm"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
