export const ASSIGNMENT_ENTITY_TYPES = [
  "ad_idea",
  "trending_ad",
  "project",
  "lead",
  "financial",
  "marketing",
  "strategy",
  "investment",
  "freeform",
] as const;

export type AssignmentEntityType = (typeof ASSIGNMENT_ENTITY_TYPES)[number];

export const ENTITY_LABELS: Record<AssignmentEntityType, string> = {
  ad_idea: "Ad idea",
  trending_ad: "Trending ad",
  project: "Project",
  lead: "Lead",
  financial: "Financial",
  marketing: "Marketing",
  strategy: "Strategy",
  investment: "Investment",
  freeform: "Task",
};
