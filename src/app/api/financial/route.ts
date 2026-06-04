import { NextResponse } from "next/server";
import { buildProjections } from "@/lib/research/projection-engine";
import { getProfile } from "@/lib/store/settings";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { FinancialAssumptions, FinancialSnapshot } from "@/lib/types/domain";

export async function GET() {
  const financial = await getSnapshot<FinancialSnapshot>("financial");
  const profile = await getProfile();
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
    assumptions = { ...assumptions, ...body.assumptions } as FinancialAssumptions;
  }
  if (body.profile) {
    Object.assign(profile, body.profile);
  }

  const updated = buildProjections(
    profile,
    assumptions,
    body.narrative ?? existing.narrative,
    existing.leverageVariables,
  );
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
