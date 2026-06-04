export type RegionCode = "US" | "India" | string;

export type DataSource = "ai" | "user" | "search";

export interface Citation {
  title: string;
  uri?: string;
}

export interface Provenance {
  source: DataSource;
  generatedAt: string;
  confidence?: number;
  citations: Citation[];
  isUserEdited: boolean;
  overrideHistory: Array<{ value: unknown; at: string }>;
}

export interface EditableValue<T> extends Provenance {
  value: T;
}

export interface OnboardingProfile {
  businessName: string;
  website: string;
  serviceDomain: string;
  targetAudience: string;
  regions: RegionCode[];
  currentMrr: number;
  goalRevenue: number;
  goalMonths: number;
  strategicGoals: string;
  constraints: string;
  completedAt?: string;
}

export interface DemandSignal {
  id: string;
  region: RegionCode;
  rank: number;
  title: string;
  description: string;
  ticketSizeMin: number;
  ticketSizeMax: number;
  currency: string;
  provenance: Provenance;
}

export type ProjectStatus = "active" | "done";

export interface MarketProject {
  id: string;
  region: RegionCode;
  title: string;
  summary: string;
  explanation: string;
  ticketSize: number;
  currency: string;
  effort: "low" | "medium" | "high";
  expectedValue: string;
  nextStep: string;
  status: ProjectStatus;
  provenance: Provenance;
  completedAt?: string;
}

export interface FinancialAssumptions {
  averageTicketUs: number;
  averageTicketIndia: number;
  closeRate: number;
  leadVolume: number;
  leadToCallRate: number;
  callToCloseRate: number;
  deliveryCapacity: number;
  hiringCost: number;
  hiringMonth: number;
  grossMarginTarget: number;
  marketingSpend: number;
  toolingSpend: number;
  retentionRate: number;
}

export interface MonthlyProjection {
  month: number;
  revenue: number;
  cumulativeRevenue: number;
  investment: number;
  pipelineNeeded: number;
}

export interface FinancialSnapshot {
  assumptions: EditableValue<FinancialAssumptions>;
  projections: MonthlyProjection[];
  scenarios: {
    conservative: number[];
    base: number[];
    aggressive: number[];
  };
  gapToGoal: number;
  monthlyPaceRequired: number;
  investmentByCategory: Record<string, number>;
  leverageVariables: string[];
  narrative: string;
  provenance: Provenance;
}

export interface MarketingItem {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  region?: RegionCode;
  provenance: Provenance;
}

export interface MarketingSnapshot {
  positioning: string;
  contentThemes: MarketingItem[];
  offers: MarketingItem[];
  channels: MarketingItem[];
  proofAssets: MarketingItem[];
  provenance: Provenance;
}

export interface StrategySnapshot {
  idealCustomerProfile: string;
  demandClusters: string[];
  regionComparison: Record<RegionCode, string>;
  marketFit: string;
  expansionOpportunities: string[];
  risks: string[];
  priorities: string[];
  provenance: Provenance;
}

export interface InvestmentAllocation {
  category: string;
  amount: number;
  percentage: number;
  rationale: string;
  expectedOutcome: string;
  provenance: Provenance;
}

export interface InvestmentSnapshot {
  totalRecommended: number;
  allocations: InvestmentAllocation[];
  provenance: Provenance;
}

export type ResearchStageId =
  | "domain_understanding"
  | "demand_discovery"
  | "regional_projects"
  | "financial_modeling"
  | "marketing_planning"
  | "investment_allocation";

export interface ResearchStage {
  id: ResearchStageId;
  label: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  message?: string;
  error?: string;
}

export interface ResearchJob {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  stages: ResearchStage[];
  startedAt: string;
  completedAt?: string;
}

export const DEFAULT_REGIONS: RegionCode[] = ["US", "India"];

export const RESEARCH_STAGE_DEFINITIONS: Array<{
  id: ResearchStageId;
  label: string;
}> = [
  { id: "domain_understanding", label: "Understanding your business domain" },
  { id: "demand_discovery", label: "Discovering top audience demands" },
  { id: "regional_projects", label: "Researching regional project opportunities" },
  { id: "financial_modeling", label: "Building financial projections" },
  { id: "marketing_planning", label: "Creating marketing recommendations" },
  { id: "investment_allocation", label: "Planning investment allocation" },
];

export const PROJECTS_PER_REGION = 10;
