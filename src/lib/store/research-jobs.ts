import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { researchJobs } from "@/lib/db/schema";
import type { ResearchJob, ResearchStage } from "@/lib/types/domain";
import { RESEARCH_STAGE_DEFINITIONS } from "@/lib/types/domain";

export function createInitialStages(): ResearchStage[] {
  return RESEARCH_STAGE_DEFINITIONS.map((s) => ({
    id: s.id,
    label: s.label,
    status: "pending",
    progress: 0,
  }));
}

export async function saveResearchJob(job: ResearchJob): Promise<void> {
  const db = getDb();
  const stages = JSON.stringify(job.stages);
  const existing = await db
    .select()
    .from(researchJobs)
    .where(eq(researchJobs.id, job.id))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(researchJobs).values({
      id: job.id,
      status: job.status,
      stages,
      startedAt: job.startedAt,
      completedAt: job.completedAt ?? null,
    });
  } else {
    await db
      .update(researchJobs)
      .set({
        status: job.status,
        stages,
        completedAt: job.completedAt ?? null,
      })
      .where(eq(researchJobs.id, job.id));
  }
}

export async function getResearchJob(id: string): Promise<ResearchJob | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(researchJobs)
    .where(eq(researchJobs.id, id))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    status: row.status as ResearchJob["status"],
    stages: JSON.parse(row.stages) as ResearchStage[],
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
  };
}

export async function getLatestResearchJob(): Promise<ResearchJob | null> {
  const db = getDb();
  const rows = await db.select().from(researchJobs);
  if (rows.length === 0) return null;
  const sorted = rows.sort(
    (a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
  const row = sorted[0];
  return {
    id: row.id,
    status: row.status as ResearchJob["status"],
    stages: JSON.parse(row.stages) as ResearchStage[],
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? undefined,
  };
}
