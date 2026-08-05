import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { leadCallLogs } from "@/lib/db/schema";
import { getCurrentOrg } from "@/lib/auth/session";
import type { CallOutcome, LeadCallLog } from "@/lib/types/domain";

function toRecord(row: typeof leadCallLogs.$inferSelect): LeadCallLog {
  return {
    id: row.id,
    leadId: row.leadId,
    calledAt: row.calledAt,
    outcome: row.outcome as CallOutcome,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
  };
}

export async function addCallLog(
  leadId: string,
  outcome: CallOutcome,
  notes?: string,
): Promise<LeadCallLog> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    orgId,
    leadId,
    calledAt: now,
    outcome,
    notes: notes ?? null,
    createdAt: now,
  };
  await db.insert(leadCallLogs).values(row);
  return toRecord(row);
}

export async function getCallLogsForLead(leadId: string): Promise<LeadCallLog[]> {
  const { orgId } = await getCurrentOrg();
  const db = getDb();
  const rows = await db
    .select()
    .from(leadCallLogs)
    .where(and(eq(leadCallLogs.orgId, orgId), eq(leadCallLogs.leadId, leadId)))
    .orderBy(desc(leadCallLogs.calledAt));
  return rows.map(toRecord);
}
