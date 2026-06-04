import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { financialVariablesPrompt } from "@/lib/ai/prompts";
import { financialMetricWorkbookAiSchema, safeParse } from "@/lib/agents/validate";
import { createProvenance } from "@/lib/db/provenance";
import { newId } from "@/lib/id";
import {
  applyLinkedInAdsToLineItems,
  fetchLinkedInAdHistory,
} from "@/lib/integrations/linkedin-ads";
import { sanitizeAssumptions } from "@/lib/research/assumption-bounds";
import {
  defaultExpenseLineItemsForDomain,
  migrateAssumptionsToLineItems,
} from "@/lib/research/expense-line-items";
import { normalizeMetricWorkbook } from "@/lib/research/financial-pl-engine";
import {
  buildProjections,
  defaultAssumptions,
} from "@/lib/research/projection-engine";
import type {
  ExpenseLineItem,
  FinancialAssumptions,
  FinancialMetricWorkbook,
  FinancialSnapshot,
  OnboardingProfile,
} from "@/lib/types/domain";

type RawFinancial = Partial<FinancialAssumptions> & {
  narrative: string;
  leverageVariables: string[];
  expenseLineItems?: ExpenseLineItem[];
  metrics?: FinancialMetricWorkbook["metrics"];
  conservative?: Record<string, number[]>;
  ambitious?: Record<string, number[]>;
  monthlyChurnRate?: number;
};

function workbookFromAi(
  profile: OnboardingProfile,
  raw: RawFinancial,
): FinancialMetricWorkbook {
  const parsed = safeParse(financialMetricWorkbookAiSchema, raw);
  const metrics = (parsed?.metrics ?? raw.metrics ?? []).map((m, i) => ({
    ...m,
    id: m.id || newId(),
    order: m.order ?? (i + 1) * 10,
  }));

  return normalizeMetricWorkbook(profile, {
    metrics,
    conservative: parsed?.conservative ?? raw.conservative,
    ambitious: parsed?.ambitious ?? raw.ambitious,
    activeScenario: "ambitious",
    monthlyChurnRate: parsed?.monthlyChurnRate ?? raw.monthlyChurnRate,
  });
}

export async function runFinancialModeling(
  profile: OnboardingProfile,
  jobId: string,
): Promise<FinancialSnapshot> {
  const trace: AiCallTrace = {
    operation: "research.financial_model",
    category: "research",
    correlationId: jobId,
    researchStage: "financial_modeling",
  };

  const linkedInAdHistory = await fetchLinkedInAdHistory(profile);
  const templateItems = defaultExpenseLineItemsForDomain(profile);

  const result = await generateStructuredJson<RawFinancial>({
    task: "financial_variables",
    systemInstruction: `Financial analyst for ${profile.serviceDomain}. Build a full P&L metric grid with monthly values per row. Currency: ${profile.currency}. JSON only.`,
    userPrompt: `${financialVariablesPrompt(profile)}

Optional expenseLineItems baseline names:
${templateItems.map((i) => `- ${i.name} (${i.category})`).join("\n")}

LinkedIn ad intelligence:
${linkedInAdHistory.available ? `Available. Last months: ${linkedInAdHistory.monthlySpend.map((m) => `${m.month}: ${m.amount}`).join(", ")}.` : linkedInAdHistory.message}`,
    useGoogleSearch: true,
    parse: (raw) => raw as RawFinancial,
    trace,
  });

  const defaults = defaultAssumptions(profile);
  const { narrative, leverageVariables, ...rawAssumptions } = result.data;

  let merged = migrateAssumptionsToLineItems(
    { ...rawAssumptions, expenseLineItems: result.data.expenseLineItems },
    profile,
    defaults,
  );
  merged = sanitizeAssumptions(profile, merged, defaults);
  merged.expenseLineItems = applyLinkedInAdsToLineItems(
    merged.expenseLineItems,
    linkedInAdHistory,
  );
  merged = migrateAssumptionsToLineItems(merged, profile, defaults);

  const metricWorkbook = workbookFromAi(profile, result.data);

  const snapshot = buildProjections(
    profile,
    merged,
    narrative,
    leverageVariables,
    metricWorkbook,
  );
  snapshot.linkedInAdHistory = linkedInAdHistory;
  snapshot.provenance = createProvenance("search", result.citations, 0.85);
  snapshot.assumptions = {
    ...snapshot.assumptions,
    ...createProvenance("search", result.citations, 0.85),
  };
  return snapshot;
}
