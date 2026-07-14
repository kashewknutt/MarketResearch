import type { ProjectLeadCategory } from "@/lib/types/domain";

export const PROJECT_LEAD_CATEGORY_LABELS: Record<ProjectLeadCategory, string> = {
  already_using: "Already using",
  in_need: "In need",
  would_benefit: "Would benefit",
};

export const PROJECT_LEAD_CATEGORY_COLORS: Record<ProjectLeadCategory, string> = {
  already_using: "bg-sky-50 text-sky-700",
  in_need: "bg-rose-50 text-rose-700",
  would_benefit: "bg-emerald-50 text-emerald-700",
};

export type ProjectLeadProgressStageId =
  | "classify"
  | "discover"
  | "insights"
  | "messages";

export interface ProjectLeadProgressStage {
  id: ProjectLeadProgressStageId;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
}

export const PROJECT_LEAD_PROGRESS_STAGES: ProjectLeadProgressStage[] = [
  { id: "classify", label: "Classifying project", status: "pending" },
  { id: "discover", label: "Finding companies", status: "pending" },
  { id: "insights", label: "Analyzing CEO perspectives", status: "pending" },
  { id: "messages", label: "Writing opening messages", status: "pending" },
];
