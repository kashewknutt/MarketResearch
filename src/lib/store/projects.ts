import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { projects as projectsTable } from "@/lib/db/schema";
import { getCurrentOrg } from "@/lib/auth/session";
import type { MarketProject, RegionCode } from "@/lib/types/domain";
import { PROJECTS_PER_REGION } from "@/lib/types/domain";

export async function getProjectsByRegion(
  region: RegionCode,
  status?: "active" | "done",
): Promise<MarketProject[]> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const rows = await db
    .select()
    .from(projectsTable)
    .where(
      status
        ? and(
            eq(projectsTable.orgId, orgId),
            eq(projectsTable.region, region),
            eq(projectsTable.status, status),
          )
        : and(
            eq(projectsTable.orgId, orgId),
            eq(projectsTable.region, region),
          ),
    );
  return rows
    .map((r) => JSON.parse(r.data) as MarketProject)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getAllActiveProjects(): Promise<MarketProject[]> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const rows = await db
    .select()
    .from(projectsTable)
    .where(
      and(eq(projectsTable.orgId, orgId), eq(projectsTable.status, "active")),
    );
  return rows.map((r) => JSON.parse(r.data) as MarketProject);
}

export async function getProjectById(
  id: string,
): Promise<MarketProject | null> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const rows = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.orgId, orgId), eq(projectsTable.id, id)))
    .limit(1);
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].data) as MarketProject;
}

export async function saveProject(
  project: MarketProject,
  sortOrder: number,
): Promise<void> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const data = JSON.stringify(project);
  const existing = await db
    .select()
    .from(projectsTable)
    .where(
      and(eq(projectsTable.orgId, orgId), eq(projectsTable.id, project.id)),
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(projectsTable).values({
      id: project.id,
      orgId,
      region: project.region,
      status: project.status,
      data,
      sortOrder,
    });
  } else {
    await db
      .update(projectsTable)
      .set({ data, status: project.status, sortOrder })
      .where(
        and(eq(projectsTable.orgId, orgId), eq(projectsTable.id, project.id)),
      );
  }
}

export async function countActiveByRegion(region: RegionCode): Promise<number> {
  const active = await getProjectsByRegion(region, "active");
  return active.length;
}

export async function clearProjectsForRegion(region: RegionCode): Promise<void> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  await db
    .delete(projectsTable)
    .where(
      and(eq(projectsTable.orgId, orgId), eq(projectsTable.region, region)),
    );
}

export async function ensureProjectCapacity(
  region: RegionCode,
): Promise<number> {
  const count = await countActiveByRegion(region);
  return Math.max(0, PROJECTS_PER_REGION - count);
}
