import { NextResponse } from "next/server";
import { getCurrentOrg, getCurrentUserId } from "@/lib/auth/session";
import {
  ASSIGNMENT_STATUSES,
  getAssignmentById,
  updateAssignmentStatus,
  type AssignmentStatus,
} from "@/lib/store/assignments";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { orgId } = await getCurrentOrg();
  const userId = await getCurrentUserId();

  const existing = await getAssignmentById(orgId, id);
  if (!existing) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
  if (existing.assigneeUserId !== userId) {
    return NextResponse.json({ error: "Only the assignee can update this task" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const status = body.status as AssignmentStatus;
  if (!ASSIGNMENT_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const assignment = await updateAssignmentStatus(orgId, id, status);
  return NextResponse.json({ assignment });
}
