import { newId } from "@/lib/id";
import type {
  ExpenseCategory,
  ExpenseLineItem,
  FinancialAssumptions,
  OnboardingProfile,
} from "@/lib/types/domain";

export function newExpenseLineId(): string {
  return newId();
}

/** Default rows tailored to service domain (AI fills amounts on first run). */
export function defaultExpenseLineItemsForDomain(
  profile: OnboardingProfile,
): ExpenseLineItem[] {
  const d = profile.serviceDomain.toLowerCase();
  const currency = profile.currency;

  if (
    d.includes("software") ||
    d.includes("dev") ||
    d.includes("engineering") ||
    d.includes("saas")
  ) {
    return [
      line("Developers", "people", 0, { headcount: 2 }),
      line("Designers", "people", 0, { headcount: 1 }),
      line("Project / delivery lead", "people", 0, { headcount: 1 }),
      line("Sales & marketing staff", "people", 0, { headcount: 1 }),
      line("AI & dev tools", "tools", 0),
      line("Cloud & hosting", "tools", 0),
      line("LinkedIn Ads", "marketing", 0, { source: "linkedin" }),
      line("Other paid ads", "marketing", 0),
      line("Contractors & freelancers", "operations", 0),
      line("Office & admin", "operations", 0),
    ];
  }

  if (d.includes("market") || d.includes("agency")) {
    return [
      line("Account / strategy", "people", 0),
      line("Content & creative", "people", 0),
      line("Paid media specialists", "people", 0),
      line("AI & analytics tools", "tools", 0),
      line("LinkedIn Ads", "marketing", 0, { source: "linkedin" }),
      line("Meta / Google ads", "marketing", 0),
      line("Freelance production", "operations", 0),
    ];
  }

  return [
    line("Delivery team", "people", 0),
    line("Sales & marketing", "people", 0),
    line("Software & tools", "tools", 0),
    line("LinkedIn Ads", "marketing", 0, { source: "linkedin" }),
    line("Other advertising", "marketing", 0),
    line("Operations & overhead", "operations", 0),
  ];
}

function line(
  name: string,
  category: ExpenseCategory,
  monthlyAmount: number,
  extra?: Partial<ExpenseLineItem>,
): ExpenseLineItem {
  return {
    id: newExpenseLineId(),
    name,
    category,
    monthlyAmount,
    source: "ai",
    ...extra,
  };
}

export function expenseForMonth(
  items: ExpenseLineItem[],
  month: number,
): { total: number; byLine: Record<string, number>; byCategory: Record<ExpenseCategory, number> } {
  const byLine: Record<string, number> = {};
  const byCategory: Record<ExpenseCategory, number> = {
    people: 0,
    tools: 0,
    marketing: 0,
    operations: 0,
    other: 0,
  };
  let total = 0;

  for (const item of items) {
    if (item.startMonth != null && month < item.startMonth) continue;
    const amt = Math.round(item.monthlyAmount);
    byLine[item.id] = amt;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + amt;
    total += amt;
  }

  return { total, byLine, byCategory };
}

export function syncLegacySpendFields(
  assumptions: FinancialAssumptions,
): FinancialAssumptions {
  const items = assumptions.expenseLineItems ?? [];
  const marketing = items
    .filter((i) => i.category === "marketing")
    .reduce((s, i) => s + i.monthlyAmount, 0);
  const tooling = items
    .filter((i) => i.category === "tools")
    .reduce((s, i) => s + i.monthlyAmount, 0);
  const people = items
    .filter((i) => i.category === "people")
    .reduce((s, i) => s + i.monthlyAmount, 0);

  return {
    ...assumptions,
    marketingSpend: marketing || assumptions.marketingSpend,
    toolingSpend: tooling || assumptions.toolingSpend,
    hiringCost: people > 0 ? people : assumptions.hiringCost,
    expenseLineItems: items,
  };
}

export function migrateAssumptionsToLineItems(
  raw: Partial<FinancialAssumptions>,
  profile: OnboardingProfile,
  defaults: Partial<FinancialAssumptions> & Pick<FinancialAssumptions, "marketingSpend" | "toolingSpend" | "hiringCost">,
): FinancialAssumptions {
  const mergedDefaults = defaults as FinancialAssumptions;
  let items = raw.expenseLineItems;
  if (!items?.length) {
    items = defaultExpenseLineItemsForDomain(profile);
    if (raw.marketingSpend || mergedDefaults.marketingSpend) {
      const li = items.find((i) => i.name.toLowerCase().includes("linkedin"));
      if (li) li.monthlyAmount = raw.marketingSpend ?? mergedDefaults.marketingSpend;
      const other = items.find((i) => i.name.toLowerCase().includes("other") && i.category === "marketing");
      if (other && !li) other.monthlyAmount = raw.marketingSpend ?? mergedDefaults.marketingSpend;
    }
    const aiTools = items.find((i) => i.category === "tools");
    if (aiTools) aiTools.monthlyAmount = raw.toolingSpend ?? mergedDefaults.toolingSpend;
    const devs = items.filter((i) => i.category === "people");
    if (devs.length && (raw.hiringCost ?? mergedDefaults.hiringCost)) {
      const perPerson = Math.round((raw.hiringCost ?? mergedDefaults.hiringCost) / devs.length);
      devs.forEach((d) => {
        d.monthlyAmount = perPerson;
      });
    }
  }

  return syncLegacySpendFields({
    ...mergedDefaults,
    ...raw,
    expenseLineItems: items.map((i) => ({
      ...i,
      id: i.id || newExpenseLineId(),
    })),
  });
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  people: "People",
  tools: "Tools & software",
  marketing: "Marketing & ads",
  operations: "Operations",
  other: "Other",
};
