import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { aiLogs } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/auth/session";
import { getAllActiveProjects } from "@/lib/store/projects";
import { getDemandsByRegion } from "@/lib/store/demands";
import { getProfile } from "@/lib/store/settings";
import { getSnapshot } from "@/lib/store/snapshots";

export async function GET() {
  const userId = await getCurrentUserId();
  const db = getDb();
  const logs = await db
    .select()
    .from(aiLogs)
    .where(eq(aiLogs.userId, userId))
    .orderBy(desc(aiLogs.id))
    .limit(50);

  const profile = await getProfile();
  const citations: Array<{ title: string; uri?: string; from: string }> = [];

  if (profile) {
    for (const region of profile.regions) {
      const demands = await getDemandsByRegion(region);
      for (const d of demands) {
        for (const c of d.provenance.citations) {
          citations.push({ ...c, from: `Demand: ${d.title}` });
        }
      }
    }
  }

  const projects = await getAllActiveProjects();
  for (const p of projects) {
    for (const c of p.provenance.citations) {
      citations.push({ ...c, from: `Project: ${p.title}` });
    }
  }

  for (const key of ["financial", "marketing", "strategy", "investment"] as const) {
    const snap = await getSnapshot<{ provenance?: { citations: Array<{ title: string; uri?: string }> } }>(key);
    if (snap?.provenance?.citations) {
      for (const c of snap.provenance.citations) {
        citations.push({ ...c, from: key });
      }
    }
  }

  return NextResponse.json({ logs, citations });
}
