export type RequirementId =
  | "env_api_key"
  | "gemini_api"
  | "model_access"
  | "google_search"
  | "billing_quota"
  | "local_storage"
  | "reddit_optional"
  | "linkedin_optional"
  | "youtube_optional"
  | "linkedin_publish_optional";

/** Required for onboarding; optional integration checks never block continue. */
export const REQUIRED_REQUIREMENT_IDS: RequirementId[] = [
  "env_api_key",
  "gemini_api",
  "model_access",
  "google_search",
  "billing_quota",
  "local_storage",
];

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
  /** Count of required checks that passed (excludes skipped optional). */
  requiredPassed: number;
  requiredTotal: number;
}

export interface SetupVerificationRecord {
  passedAt: string;
  report: SetupRequirementsReport;
}
