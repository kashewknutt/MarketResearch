export type RefreshSection =
  | "all"
  | "financial"
  | "leads"
  | "marketing"
  | "projects"
  | "strategy"
  | "investment"
  | "competitors"
  | "ads"
  | "sources"
  | "api-costs";

export const REFRESH_SECTION_LABELS: Record<RefreshSection, string> = {
  all: "Refresh all research",
  financial: "Refresh financials",
  leads: "Refresh leads",
  marketing: "Refresh marketing",
  projects: "Refresh projects",
  strategy: "Refresh strategy",
  investment: "Refresh investment plan",
  competitors: "Refresh competitors",
  ads: "Refresh ad trends",
  sources: "Reload sources",
  "api-costs": "Refresh live pricing",
};

export function refreshSectionFromPath(pathname: string): RefreshSection {
  if (pathname.startsWith("/financial-analysis")) return "financial";
  if (pathname.startsWith("/leads")) return "leads";
  if (pathname.startsWith("/marketing")) return "marketing";
  if (pathname.startsWith("/projects")) return "projects";
  if (pathname.startsWith("/strategy")) return "strategy";
  if (pathname.startsWith("/investment-planner")) return "investment";
  if (pathname.startsWith("/ads")) return "ads";
  if (pathname.startsWith("/research-sources")) return "sources";
  if (pathname.startsWith("/api-costs")) return "api-costs";
  if (pathname.startsWith("/dashboard")) return "all";
  if (pathname.startsWith("/settings")) return "all";
  return "all";
}

export function pageTitleFromPath(pathname: string): string {
  const map: Record<string, string> = {
    "/dashboard": "Dashboard",
    "/projects": "Projects",
    "/leads": "Leads",
    "/financial-analysis": "Financial Analysis",
    "/marketing": "Marketing",
    "/strategy": "Strategy",
    "/investment-planner": "Investment Planner",
    "/ads": "Ads & Content",
    "/research-sources": "Research Sources",
    "/api-costs": "API Costs",
    "/settings": "Settings",
  };
  return map[pathname] ?? "Market Research";
}
