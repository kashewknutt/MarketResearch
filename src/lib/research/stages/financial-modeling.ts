import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { financialVariablesPrompt } from "@/lib/ai/prompts";
import { createProvenance } from "@/lib/db/provenance";
import {
  applyLinkedInAdsToLineItems,
  fetchLinkedInAdHistory,
} from "@/lib/integrations/linkedin-ads";
import { sanitizeAssumptions } from "@/lib/research/assumption-bounds";
import {
  defaultExpenseLineItemsForDomain,
  migrateAssumptionsToLineItems,
} from "@/lib/research/expense-line-items";
import {
  buildProjections,
  defaultAssumptions,
} from "@/lib/research/projection-engine";
import { normalizeMonthlyPlans } from "@/lib/research/financial-timeline-engine";
import type {
  ExpenseLineItem,
  FinancialAssumptions,
  FinancialIncomeDrivers,
  FinancialMonthlyPlans,
  FinancialSnapshot,
  MonthlyIncomeRow,
  OnboardingProfile,
} from "@/lib/types/domain";

type RawFinancial = Partial<FinancialAssumptions> & {
  narrative: string;
  leverageVariables: string[];
  expenseLineItems?: ExpenseLineItem[];
  incomeDrivers?: {
    conservative?: FinancialIncomeDrivers;
    ambitious?: FinancialIncomeDrivers;
  };
  monthlyPlans?: {
    conservative?: MonthlyIncomeRow[];
    ambitious?: MonthlyIncomeRow[];
  };
};

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
    systemInstruction: `Financial analyst for ${profile.serviceDomain} service businesses. Estimate realistic monthly costs per line item in ${profile.currency}. JSON only.`,
    userPrompt: `${financialVariablesPrompt(profile)}

Use these expense line item names for ${profile.serviceDomain} (estimate monthlyAmount for each in ${profile.currency}):
${templateItems.map((i) => `- ${i.name} (${i.category})`).join("\n")}

LinkedIn ad intelligence:
${linkedInAdHistory.available ? `Available. Last months: ${linkedInAdHistory.monthlySpend.map((m) => `${m.month}: ${m.amount}`).join(", ")}. ${linkedInAdHistory.message}` : linkedInAdHistory.message}

Return expenseLineItems array with id, name, category, monthlyAmount, optional headcount, unitCost, notes.`,
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

  const monthlyPlans = normalizeMonthlyPlans(profile, merged, {
    conservative: result.data.monthlyPlans?.conservative,
    ambitious: result.data.monthlyPlans?.ambitious,
    incomeDrivers: result.data.incomeDrivers
      ? {
          conservative: result.data.incomeDrivers.conservative!,
          ambitious: result.data.incomeDrivers.ambitious!,
        }
      : undefined,
    activeScenario: "ambitious",
  } as Partial<FinancialMonthlyPlans>);

  const snapshot = buildProjections(
    profile,
    merged,
    narrative,
    leverageVariables,
    monthlyPlans,
  );
  snapshot.linkedInAdHistory = linkedInAdHistory;
  snapshot.provenance = createProvenance("search", result.citations, 0.85);
  snapshot.assumptions = {
    ...snapshot.assumptions,
    ...createProvenance("search", result.citations, 0.85),
  };
  return snapshot;
}
