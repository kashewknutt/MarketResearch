export type RequirementId =
  | "env_api_key"
  | "gemini_api"
  | "model_access"
  | "google_search"
  | "billing_quota"
  | "local_storage";

export type RequirementState = "pending" | "passed" | "failed" | "skipped";

export interface RequirementCheckResult {
  id: RequirementId;
  label: string;
  description: string;
  state: RequirementState;
  message: string;
  detail?: string;
  actionLabel?: string;
  actionUrl?: string;
}

export interface SetupRequirementsReport {
  allPassed: boolean;
  checkedAt: string;
  checks: RequirementCheckResult[];
}

export interface SetupVerificationRecord {
  passedAt: string;
  report: SetupRequirementsReport;
}
