"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "For You" },
  { href: "/projects", label: "Projects" },
  { href: "/leads", label: "Leads" },
  { href: "/financial-analysis", label: "Financial Analysis" },
  { href: "/marketing", label: "Marketing" },
  { href: "/ads", label: "Ads & Content" },
  { href: "/strategy", label: "Strategy" },
  { href: "/investment-planner", label: "Investment Planner" },
  { href: "/research-sources", label: "Research Sources" },
  { href: "/api-costs", label: "API Costs" },
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar({ businessName }: { businessName?: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col border-r border-slate-100 bg-[#faf9fc] px-3 py-6">
      <div className="mb-8 px-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Northstar
        </p>
        <h1 className="mt-1 text-sm font-semibold text-slate-800">
          {businessName ?? "Your Business"}
        </h1>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-white font-medium text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-white/60 hover:text-slate-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
