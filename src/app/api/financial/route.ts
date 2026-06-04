import { NextResponse } from "next/server";
import { syncLegacySpendFields } from "@/lib/research/expense-line-items";
import { buildDefaultExpenseTable } from "@/lib/research/financial-timeline-engine";
import { normalizeFinancialSnapshot } from "@/lib/research/normalize-financial";
import { buildProjections } from "@/lib/research/projection-engine";
import { getProfile } from "@/lib/store/settings";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type {
  FinancialAssumptions,
  FinancialMonthlyPlans,
  FinancialSnapshot,
} from "@/lib/types/domain";

export async function GET() {
  const raw = await getSnapshot<FinancialSnapshot>("financial");
  const profile = await getProfile();
  const financial =
    raw && profile ? normalizeFinancialSnapshot(raw, profile) : raw;
  return NextResponse.json({ financial, profile });
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not onboarded" }, { status: 404 });
  }
  const existing = await getSnapshot<FinancialSnapshot>("financial");
  if (!existing) {
    return NextResponse.json({ error: "No financial data" }, { status: 404 });
  }

  const body = await request.json();
  let assumptions = existing.assumptions.value;

  if (body.assumptions) {
    assumptions = syncLegacySpendFields({
      ...assumptions,
      ...body.assumptions,
    } as FinancialAssumptions);
  }

  let monthlyPlans: FinancialMonthlyPlans | undefined = existing.monthlyPlans;
  if (body.monthlyPlans) {
    monthlyPlans = {
      ...existing.monthlyPlans,
      ...body.monthlyPlans,
      activeScenario:
        body.monthlyPlans.activeScenario ??
        existing.monthlyPlans?.activeScenario ??
        "ambitious",
    } as FinancialMonthlyPlans;
  } else if (body.activeScenario && monthlyPlans) {
    monthlyPlans = { ...monthlyPlans, activeScenario: body.activeScenario };
  }

  if (body.assumptions?.expenseLineItems && monthlyPlans) {
    monthlyPlans = {
      ...monthlyPlans,
      expenses: buildDefaultExpenseTable(profile, assumptions.expenseLineItems),
    };
  }

  const updated = buildProjections(
    profile,
    assumptions,
    body.narrative ?? existing.narrative,
    existing.leverageVariables,
    monthlyPlans,
  );
  updated.linkedInAdHistory = existing.linkedInAdHistory;
  updated.assumptions = {
    ...existing.assumptions,
    value: assumptions,
    source: "user",
    isUserEdited: true,
    overrideHistory: [
      ...existing.assumptions.overrideHistory,
      { value: existing.assumptions.value, at: new Date().toISOString() },
    ],
  };
  updated.provenance = {
    ...existing.provenance,
    source: "user",
    isUserEdited: true,
  };

  await saveSnapshot("financial", updated);
  return NextResponse.json({ financial: updated });
}
