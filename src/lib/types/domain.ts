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
  /** Service-business simulation (optional; defaults applied in engine). */
  dealMixLowFrequency?: number;
  dealMixMidTicket?: number;
  dealMixHighTicket?: number;
  dealMixWhale?: number;
  ticketLow?: number;
  ticketMid?: number;
  ticketHigh?: number;
  ticketWhale?: number;
  monthsWithZeroCashPct?: number;
  retainerConversionRate?: number;
  retainerMrrFraction?: number;
}

export type FinancialScenario = "conservative" | "ambitious";

/** Global knobs used to seed monthly income tables. */
export interface FinancialIncomeDrivers {
  lowTicketClientsPerMonth: number;
  lowTicketMrrEach: number;
  highTicketsPerYear: number;
  highTicketAmount: number;
  whalesPerYear: number;
  whaleAmount: number;
  monthlyChurnRate: number;
}

export interface MonthlyExpenseRow {
  month: number;
  totalExpenses: number;
  userEdited?: boolean;
}

export interface MonthlyIncomeRow {
  month: number;
  lowTicketClients: number;
  lowTicketMrr: number;
  highTicketCash: number;
  whaleCash: number;
  userEdited?: boolean;
}

export interface FinancialMonthlyPlans {
  conservative: MonthlyIncomeRow[];
  ambitious: MonthlyIncomeRow[];
  expenses: MonthlyExpenseRow[];
  activeScenario: FinancialScenario;
  incomeDrivers?: {
    conservative: FinancialIncomeDrivers;
    ambitious: FinancialIncomeDrivers;
  };
}

export type FinancialMetricKind = "revenue" | "expense";

export interface FinancialMetricDefinition {
  id: string;
  label: string;
  kind: FinancialMetricKind;
  group?: string;
  /** Contributes to recurring MRR roll-forward when true. */
  recurring?: boolean;
  order: number;
  notes?: string;
  userDefined?: boolean;
}

/** metricId -> values per month (index 0 = month 1). */
export type FinancialScenarioValues = Record<string, number[]>;

export interface FinancialMetricWorkbook {
  metrics: FinancialMetricDefinition[];
  conservative: FinancialScenarioValues;
  ambitious: FinancialScenarioValues;
  activeScenario: FinancialScenario;
  monthlyChurnRate?: number;
}

export interface MonthlyPlSummary {
  month: number;
  totalRevenue: number;
  totalExpenses: number;
  ebitda: number;
  netProfit: number;
  profitMarginPct: number;
  recurringMrr?: number;
}

export interface MonthlyDealBreakdown {
  lowTicket: number;
  midTicket: number;
  highTicket: number;
  whale: number;
  newRetainers: number;
}

export interface MonthlyProjection {
  month: number;
  /** Recurring MRR at end of month (stepwise, not linear). */
  revenue: number;
  /** Running sum of monthly MRR. */
  cumulativeRevenue: number;
  /** Cash collected from new deals this month (can be 0). */
  cashCollected?: number;
  /** Recurring MRR (same as revenue when using service model). */
  recurringMrr?: number;
  /** Monthly operating expenses. */
  expenses: number;
  /** @deprecated Use expenses */
  investment: number;
  pipelineNeeded: number;
  /** Net cash = cashCollected - expenses. */
  netCash?: number;
  /** @deprecated Prefer netCash */
  netMrr: number;
  totalRevenue?: number;
  totalExpenses?: number;
  ebitda?: number;
  profitMarginPct?: number;
  plSummaries?: MonthlyPlSummary[];
  newContracts?: MonthlyDealBreakdown;
  expenseByCategory?: Partial<Record<ExpenseCategory, number>>;
  expenseByLineItem?: Record<string, number>;
}

export interface FinancialSnapshot {
  assumptions: EditableValue<FinancialAssumptions>;
  /** @deprecated Use metricWorkbook */
  monthlyPlans?: FinancialMonthlyPlans;
  metricWorkbook?: FinancialMetricWorkbook;
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
  regions?: RegionCode[];
  provenance: Provenance;
  why?: string;
  whyForBusiness?: string;
  channels?: string[];
  runDuration?: string;
  operatorType?: string;
  executionNotes?: string;
  expectedMetrics?: EvidenceMetric[];
  precedents?: PrecedentRecord[];
  successCases?: PrecedentRecord[];
  failureCases?: PrecedentRecord[];
  estimatedCost?: number;
  estimatedRunCost?: number;
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
  whyPerfect?: string;
  pitchOutline?: string;
  contactPlan?: string;
  objections?: string[];
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

export type AdFormat =
  | "reel"
  | "short"
  | "meme"
  | "static_post"
  | "carousel"
  | "long_video"
  | "story"
  | "ad_creative";

export interface TrendingAdExample {
  id: string;
  platform: string;
  brandName: string;
  isOwnBrand: boolean;
  format: AdFormat;
  title: string;
  description: string;
  whyTrending: string;
  hook?: string;
  engagementSignal?: string;
  url?: string;
  thumbnailUrl?: string;
  publishedAt?: string;
  citations: Citation[];
}

export type AdIdeaStatus = "idea" | "content_ready" | "posted" | "published_linkedin";

export interface AdIdeaSourceRef {
  exampleId?: string;
  title: string;
  url?: string;
  platform?: string;
  brandName?: string;
  engagementSignal?: string;
  whyPicked: string;
}

export interface AdCreativeConstraints {
  notes: string;
  updatedAt: string;
}

export interface AdContentScene {
  order: number;
  shot: string;
  dialogueOrText: string;
  durationSec?: number;
  notes?: string;
}

export interface GeneratedAdContent {
  version: number;
  generatedAt: string;
  constraints: AdCreativeConstraints;
  script: string;
  scenes: AdContentScene[];
  captionOrPost: string;
  hashtags?: string[];
  assetNotes?: string;
  provenance: Provenance;
}

export interface LinkedInPublishRecord {
  postUrn: string;
  publishedAt: string;
  commentaryUsed: string;
}

export interface AdIdea {
  id: string;
  platform: string;
  format: AdFormat;
  title: string;
  hook: string;
  concept: string;
  scriptOrCaption: string;
  whyThisWorks: string;
  /** @deprecated kept for reading older snapshots; prefer sourceRef */
  inspiredBy?: string;
  sourceRef?: AdIdeaSourceRef;
  priority: "high" | "medium" | "low";
  provenance: Provenance;
  status: AdIdeaStatus;
  statusUpdatedAt?: string;
  generatedContent?: GeneratedAdContent;
  generatedContentHistory?: GeneratedAdContent[];
  linkedInPublish?: LinkedInPublishRecord;
}

export interface CompetitorAdActivity {
  competitorName: string;
  isDiscovered: boolean;
  examples: TrendingAdExample[];
}

export interface AdTrendsSnapshot {
  trackedCompetitors: string[];
  discoveredCompetitors: string[];
  trendingNow: TrendingAdExample[];
  ideasForYou: AdIdea[];
  competitorActivity: CompetitorAdActivity[];
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
  mrrScenarioLabel?: string;
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
  | "ad_trends"
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
  { id: "ad_trends", label: "Researching trending ads & content ideas" },
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
