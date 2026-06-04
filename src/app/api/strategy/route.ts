import { NextResponse } from "next/server";
import { getSnapshot, saveSnapshot } from "@/lib/store/snapshots";
import type { StrategySnapshot } from "@/lib/types/domain";

export async function GET() {
  const strategy = await getSnapshot<StrategySnapshot>("strategy");
  return NextResponse.json({ strategy });
}

export async function PATCH(request: Request) {
  const existing = await getSnapshot<StrategySnapshot>("strategy");
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
  await saveSnapshot("strategy", updated);
  return NextResponse.json({ strategy: updated });
}
