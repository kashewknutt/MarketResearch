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

export interface SocialLink {
  platform: string;
  url: string;
}

export interface OnboardingProfile {
  businessName: string;
  website: string;
  serviceDomain: string;
  targetAudience: string;
  regions: RegionCode[];
  socialLinks: SocialLink[];
  /** ISO 4217 code for MRR and projection amounts (e.g. USD, EUR, INR). */
  currency: string;
  /** Monthly recurring revenue today. */
  currentMrr: number;
  /** Target monthly recurring revenue at end of goalMonths (not annual/total/profit). */
  targetMrr: number;
  goalMonths: number;
  strategicGoals: string;
  constraints: string;
  completedAt?: string;
}

export interface EvidenceMetric {
  label: string;
  value: string;
  unit?: string;
}

export interface PrecedentRecord {
  company: string;
  action: string;
  reportedResult: string;
  metric?: string;
  sourceTitle?: string;
  sourceUri?: string;
}

export interface RegionalPricing {
  region: RegionCode;
  min: number;
  median: number;
  max: number;
  currency: string;
  willingnessNote: string;
  citations: Citation[];
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
  rationale?: string;
  challenges?: string[];
  solutions?: string[];
  regionalPricing?: RegionalPricing[];
  precedents?: PrecedentRecord[];
  confidenceScore?: number;
  pipelineSteps?: string[];
}

export type ExpenseCategory =
  | "people"
  | "tools"
  | "marketing"
  | "operations"
  | "other";

export interface ExpenseLineItem {
  id: string;
  name: string;
  category: ExpenseCategory;
  monthlyAmount: number;
  /** 1-based month when this cost starts (optional). */
  startMonth?: number;
  headcount?: number;
  unitCost?: number;
  notes?: string;
  source?: "ai" | "user" | "linkedin";
}

export interface LinkedInAdSpendMonth {
  month: string;
  amount: number;
  currency: string;
}

export interface LinkedInAdHistory {
  available: boolean;
  message: string;
  accountId?: string;
  totalLast12Months?: number;
  currency: string;
  monthlySpend: LinkedInAdSpendMonth[];
  citations: Citation[];
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
  /** Legacy aggregate — kept in sync with expense line items when possible. */
  marketingSpend: number;
  toolingSpend: number;
  retentionRate: number;
  /** Domain-specific monthly cost rows (developers, ads, AI tools, etc.). */
  expenseLineItems: ExpenseLineItem[];
}

export interface MonthlyProjection {
  month: number;
  /** Planned monthly recurring revenue for this month. */
  revenue: number;
  /** Running sum of monthly MRR (not ARR). */
  cumulativeRevenue: number;
  /** Monthly operating expenses (marketing + tooling + hiring). */
  expenses: number;
  /** @deprecated Use expenses — kept for backward compatibility */
  investment: number;
  pipelineNeeded: number;
  /** MRR minus monthly expenses. */
  netMrr: number;
  expenseByCategory?: Partial<Record<ExpenseCategory, number>>;
  expenseByLineItem?: Record<string, number>;
}

export interface FinancialSnapshot {
  assumptions: EditableValue<FinancialAssumptions>;
  linkedInAdHistory?: LinkedInAdHistory;
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
  why?: string;
  expectedMetrics?: EvidenceMetric[];
  precedents?: PrecedentRecord[];
  estimatedCost?: number;
  estimatedCostCurrency?: string;
  citations?: Citation[];
}

export interface MarketingSnapshot {
  positioning: string;
  contentThemes: MarketingItem[];
  offers: MarketingItem[];
  channels: MarketingItem[];
  proofAssets: MarketingItem[];
  provenance: Provenance;
}

export interface SocialPlatformStrategy {
  platform: string;
  audience: string;
  tone: string;
  contentPillars: string[];
  postingCadence: string;
  differentiation: string;
  kpis: EvidenceMetric[];
  tactics: string[];
  citations: Citation[];
}

export interface MarketingSocialSnapshot {
  platforms: SocialPlatformStrategy[];
  provenance: Provenance;
}

export type LeadStatus = "new" | "qualified" | "contacted" | "archived";

export interface LeadRecord {
  id: string;
  company: string;
  region: RegionCode;
  fitScore: number;
  signals: string[];
  contactHints: string;
  whyFit: string;
  sources: Citation[];
  status: LeadStatus;
  provenance: Provenance;
  createdAt: string;
}

export interface CompetitorRecord {
  name: string;
  region?: RegionCode;
  estimatedMarketingSpendMin: number;
  estimatedMarketingSpendMax: number;
  spendCurrency: string;
  positioning: string;
  recommendedSpendNote: string;
  sources: Citation[];
}

export interface CompetitorSnapshot {
  competitors: CompetitorRecord[];
  userRecommendedSpendMin: number;
  userRecommendedSpendMax: number;
  spendCurrency: string;
  provenance: Provenance;
}

export interface DashboardMetrics {
  currentMrr: number;
  targetMrr: number;
  gapToGoal: number;
  currency: string;
  leadCount: number;
  activeProjects: number;
  mrrSeries: Array<{ month: number; mrr: number }>;
  regionalDemandCounts: Record<string, number>;
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
  | "project_enrichment"
  | "competitor_intelligence"
  | "lead_discovery"
  | "financial_modeling"
  | "marketing_planning"
  | "social_strategy"
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
  { id: "project_enrichment", label: "Enriching projects with evidence" },
  { id: "competitor_intelligence", label: "Analyzing competitor spend & positioning" },
  { id: "lead_discovery", label: "Finding potential client companies" },
  { id: "financial_modeling", label: "Building financial projections" },
  { id: "marketing_planning", label: "Creating marketing recommendations" },
  { id: "social_strategy", label: "Building social platform playbooks" },
  { id: "investment_allocation", label: "Planning investment allocation" },
];

export const SOCIAL_PLATFORMS = [
  "LinkedIn",
  "X",
  "Instagram",
  "Facebook",
  "YouTube",
  "TikTok",
  "GitHub",
] as const;

export const PROJECTS_PER_REGION = 10;
