import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { assignments, orgMembers } from "@/lib/db/schema";

export const ASSIGNMENT_ENTITY_TYPES = [
  "ad_idea",
  "project",
  "lead",
  "financial",
  "marketing",
  "strategy",
  "investment",
  "freeform",
] as const;

export type AssignmentEntityType = (typeof ASSIGNMENT_ENTITY_TYPES)[number];

export const ASSIGNMENT_STATUSES = ["assigned", "in_progress", "done"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export interface Assignment {
  id: string;
  orgId: string;
  entityType: AssignmentEntityType;
  entityId: string | null;
  assigneeUserId: string;
  assignedByUserId: string;
  title: string;
  notes: string | null;
  status: AssignmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssignmentInput {
  orgId: string;
  entityType: AssignmentEntityType;
  entityId: string | null;
  assigneeUserId: string;
  assignedByUserId: string;
  title: string;
  notes?: string | null;
}

function toAssignment(row: typeof assignments.$inferSelect): Assignment {
  return {
    id: row.id,
    orgId: row.orgId,
    entityType: row.entityType as AssignmentEntityType,
    entityId: row.entityId,
    assigneeUserId: row.assigneeUserId,
    assignedByUserId: row.assignedByUserId,
    title: row.title,
    notes: row.notes,
    status: row.status as AssignmentStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function assertOrgMember(orgId: string, userId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);
  if (rows.length === 0) {
    throw new Error("Assignee is not a member of this organization");
  }
}

export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<Assignment> {
  await assertOrgMember(input.orgId, input.assigneeUserId);

  const db = getDb();
  const now = new Date().toISOString();
  const row = {
    id: randomUUID(),
    orgId: input.orgId,
    entityType: input.entityType,
    entityId: input.entityId,
    assigneeUserId: input.assigneeUserId,
    assignedByUserId: input.assignedByUserId,
    title: input.title,
    notes: input.notes ?? null,
    status: "assigned" as AssignmentStatus,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(assignments).values(row);
  return row;
}

export async function getAssignmentsForUser(
  orgId: string,
  userId: string,
): Promise<Assignment[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(assignments)
    .where(
      and(eq(assignments.orgId, orgId), eq(assignments.assigneeUserId, userId)),
    );
  return rows
    .map(toAssignment)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAssignmentById(
  orgId: string,
  id: string,
): Promise<Assignment | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(assignments)
    .where(and(eq(assignments.orgId, orgId), eq(assignments.id, id)))
    .limit(1);
  if (rows.length === 0) return null;
  return toAssignment(rows[0]);
}

export async function updateAssignmentStatus(
  orgId: string,
  id: string,
  status: AssignmentStatus,
): Promise<Assignment | null> {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  await db
    .update(assignments)
    .set({ status, updatedAt })
    .where(and(eq(assignments.orgId, orgId), eq(assignments.id, id)));
  return getAssignmentById(orgId, id);
}
