import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { leads } from "@/lib/db/schema";
import { getCurrentOrg } from "@/lib/auth/session";
import type { LeadRecord } from "@/lib/types/domain";

export async function saveLeads(records: LeadRecord[]): Promise<void> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  for (const lead of records) {
    const existing = await db
      .select()
      .from(leads)
      .where(and(eq(leads.orgId, orgId), eq(leads.id, lead.id)))
      .limit(1);
    const row = {
      id: lead.id,
      orgId,
      region: lead.region,
      status: lead.status,
      data: JSON.stringify(lead),
      createdAt: lead.createdAt,
    };
    if (existing.length === 0) {
      await db.insert(leads).values(row);
    } else {
      await db
        .update(leads)
        .set(row)
        .where(and(eq(leads.orgId, orgId), eq(leads.id, lead.id)));
    }
  }
}

export async function clearLeads(): Promise<void> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  await db.delete(leads).where(eq(leads.orgId, orgId));
}

export async function getAllLeads(): Promise<LeadRecord[]> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const rows = await db.select().from(leads).where(eq(leads.orgId, orgId));
  return rows
    .map((r) => JSON.parse(r.data) as LeadRecord)
    .sort((a, b) => b.fitScore - a.fitScore);
}

export async function getLeadsByRegion(region: string): Promise<LeadRecord[]> {
  const all = await getAllLeads();
  return all.filter((l) => l.region === region);
}

export function newLeadId(): string {
  return randomUUID();
}
