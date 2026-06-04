import { newId } from "@/lib/id";
import type {
  FinancialMetricDefinition,
  FinancialMetricWorkbook,
  FinancialScenario,
  FinancialScenarioValues,
  OnboardingProfile,
} from "@/lib/types/domain";

function metric(
  label: string,
  kind: "revenue" | "expense",
  order: number,
  opts?: Partial<FinancialMetricDefinition>,
): FinancialMetricDefinition {
  return {
    id: newId(),
    label,
    kind,
    order,
    ...opts,
  };
}

export function softwareAgencyMetrics(): FinancialMetricDefinition[] {
  return [
    metric("Revenue from Small Clients", "revenue", 10, {
      group: "Revenue",
      recurring: true,
    }),
    metric("Revenue from Enterprise", "revenue", 20, { group: "Revenue" }),
    metric("Huge Client 1 Revenue", "revenue", 30, { group: "Revenue" }),
    metric("Huge Client 2 Revenue", "revenue", 40, { group: "Revenue" }),
    metric("Developer Salaries", "expense", 100, { group: "People" }),
    metric("Founder Draws", "expense", 110, { group: "People" }),
    metric("Developer AI Tools", "expense", 120, { group: "Tools" }),
    metric("AI Tool Costs", "expense", 130, { group: "Tools" }),
    metric("SaaS Subscriptions", "expense", 140, { group: "Tools" }),
    metric("Cloud Hosting", "expense", 150, { group: "Tools" }),
    metric("Office/Admin", "expense", 160, { group: "Operations" }),
    metric("Marketing Spend", "expense", 170, { group: "Marketing" }),
    metric("Video Production", "expense", 180, { group: "Marketing" }),
    metric("Graphic Design", "expense", 190, { group: "Marketing" }),
    metric("Travel & Sales", "expense", 200, { group: "Sales" }),
    metric("Miscellaneous", "expense", 210, { group: "Other" }),
  ];
}

export function marketingAgencyMetrics(): FinancialMetricDefinition[] {
  return [
    metric("Retainer Clients Revenue", "revenue", 10, {
      group: "Revenue",
      recurring: true,
    }),
    metric("Project / Campaign Revenue", "revenue", 20, { group: "Revenue" }),
    metric("Enterprise Client Revenue", "revenue", 30, { group: "Revenue" }),
    metric("Account & Strategy Payroll", "expense", 100, { group: "People" }),
    metric("Creative & Production Payroll", "expense", 110, { group: "People" }),
    metric("Paid Media Specialists", "expense", 120, { group: "People" }),
    metric("AI & Analytics Tools", "expense", 130, { group: "Tools" }),
    metric("LinkedIn / Paid Ads", "expense", 140, { group: "Marketing" }),
    metric("Freelance Production", "expense", 150, { group: "Operations" }),
    metric("Office & Admin", "expense", 160, { group: "Operations" }),
    metric("Travel & Sales", "expense", 170, { group: "Sales" }),
    metric("Miscellaneous", "expense", 180, { group: "Other" }),
  ];
}

export function defaultMetricsForDomain(profile: OnboardingProfile): FinancialMetricDefinition[] {
  const d = profile.serviceDomain.toLowerCase();
  if (
    d.includes("software") ||
    d.includes("dev") ||
    d.includes("engineering") ||
    d.includes("saas")
  ) {
    return softwareAgencyMetrics();
  }
  if (d.includes("market") || d.includes("agency")) {
    return marketingAgencyMetrics();
  }
  return [
    metric("Recurring Client Revenue", "revenue", 10, {
      group: "Revenue",
      recurring: true,
    }),
    metric("Project Revenue", "revenue", 20, { group: "Revenue" }),
    metric("Large Deal Revenue", "revenue", 30, { group: "Revenue" }),
    metric("Delivery Payroll", "expense", 100, { group: "People" }),
    metric("Sales & Marketing Payroll", "expense", 110, { group: "People" }),
    metric("Tools & Software", "expense", 120, { group: "Tools" }),
    metric("Marketing Spend", "expense", 130, { group: "Marketing" }),
    metric("Operations & Admin", "expense", 140, { group: "Operations" }),
    metric("Miscellaneous", "expense", 150, { group: "Other" }),
  ];
}

export function emptyScenarioValues(
  metrics: FinancialMetricDefinition[],
  months: number,
): FinancialScenarioValues {
  const out: FinancialScenarioValues = {};
  for (const m of metrics) {
    out[m.id] = Array.from({ length: months }, () => 0);
  }
  return out;
}
