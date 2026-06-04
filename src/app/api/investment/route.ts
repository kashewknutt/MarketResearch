import { NextResponse } from "next/server";
import { getProfile } from "@/lib/store/settings";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { InvestmentSnapshot } from "@/lib/types/domain";

export async function GET() {
  const investment = await getSnapshot<InvestmentSnapshot>("investment");
  const profile = await getProfile();
  return NextResponse.json({ investment, profile });
}

export async function PATCH(request: Request) {
  const existing = await getSnapshot<InvestmentSnapshot>("investment");
  if (!existing) {
    return NextResponse.json({ error: "No data" }, { status: 404 });
  }
  const body = await request.json();
  const updated = {
    ...existing,
    ...body,
    provenance: {
      ...existing.provenance,
      source: "user" as const,
      isUserEdited: true,
    },
  };
  await saveSnapshot("investment", updated);
  return NextResponse.json({ investment: updated });
}
