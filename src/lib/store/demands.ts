import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { demandSignals } from "@/lib/db/schema";
import { getCurrentOrg } from "@/lib/auth/session";
import type { DemandSignal, RegionCode } from "@/lib/types/domain";

export async function getDemandsByRegion(
  region: RegionCode,
): Promise<DemandSignal[]> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const rows = await db
    .select()
    .from(demandSignals)
    .where(
      and(eq(demandSignals.orgId, orgId), eq(demandSignals.region, region)),
    );
  return rows
    .map((r) => JSON.parse(r.data) as DemandSignal)
    .sort((a, b) => a.rank - b.rank);
}

export async function saveDemands(signals: DemandSignal[]): Promise<void> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  for (const signal of signals) {
    const data = JSON.stringify(signal);
    const existing = await db
      .select()
      .from(demandSignals)
      .where(
        and(eq(demandSignals.orgId, orgId), eq(demandSignals.id, signal.id)),
      )
      .limit(1);
    if (existing.length === 0) {
      await db.insert(demandSignals).values({
        id: signal.id,
        orgId,
        region: signal.region,
        rank: signal.rank,
        data,
      });
    } else {
      await db
        .update(demandSignals)
        .set({ data, rank: signal.rank })
        .where(
          and(
            eq(demandSignals.orgId, orgId),
            eq(demandSignals.id, signal.id),
          ),
        );
    }
  }
}

export async function clearDemands(): Promise<void> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  await db.delete(demandSignals).where(eq(demandSignals.orgId, orgId));
}
