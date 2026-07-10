import { NextResponse } from "next/server";
import { getCurrentOrg, getCurrentUserId } from "@/lib/auth/session";
import {
  ASSIGNMENT_ENTITY_TYPES,
  createAssignment,
  getAssignmentsForUser,
  type AssignmentEntityType,
} from "@/lib/store/assignments";

export async function GET() {
  const { orgId } = await getCurrentOrg();
  const userId = await getCurrentUserId();
  const items = await getAssignmentsForUser(orgId, userId);
  return NextResponse.json({ assignments: items });
}

export async function POST(request: Request) {
  const { orgId, role } = await getCurrentOrg();
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the org owner can assign work" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const entityType = body.entityType as AssignmentEntityType;
  const entityId = typeof body.entityId === "string" ? body.entityId : null;
  const assigneeUserId = typeof body.assigneeUserId === "string" ? body.assigneeUserId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes : null;

  if (!ASSIGNMENT_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
  }
  if (!assigneeUserId) {
    return NextResponse.json({ error: "assigneeUserId is required" }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const assignedByUserId = await getCurrentUserId();

  try {
    const assignment = await createAssignment({
      orgId,
      entityType,
      entityId,
      assigneeUserId,
      assignedByUserId,
      title,
      notes,
    });
    return NextResponse.json({ assignment });
  } catch (err) {
    if (err instanceof Error && err.message.includes("not a member")) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
