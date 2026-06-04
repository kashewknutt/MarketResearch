import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { demandSignals } from "@/lib/db/schema";
import type { DemandSignal, RegionCode } from "@/lib/types/domain";

export async function getDemandsByRegion(
  region: RegionCode,
): Promise<DemandSignal[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(demandSignals)
    .where(eq(demandSignals.region, region));
  return rows
    .map((r) => JSON.parse(r.data) as DemandSignal)
    .sort((a, b) => a.rank - b.rank);
}

export async function saveDemands(signals: DemandSignal[]): Promise<void> {
  const db = getDb();
  for (const signal of signals) {
    const data = JSON.stringify(signal);
    const existing = await db
      .select()
      .from(demandSignals)
      .where(eq(demandSignals.id, signal.id))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(demandSignals).values({
        id: signal.id,
        region: signal.region,
        rank: signal.rank,
        data,
      });
    } else {
      await db
        .update(demandSignals)
        .set({ data, rank: signal.rank })
        .where(eq(demandSignals.id, signal.id));
    }
  }
}

export async function clearDemands(): Promise<void> {
  const db = getDb();
  await db.delete(demandSignals);
}
