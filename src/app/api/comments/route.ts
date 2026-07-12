import { NextResponse } from "next/server";
import { getCurrentOrg, getCurrentUserId } from "@/lib/auth/session";
import { createComment, getComments, type CommentEntityType } from "@/lib/store/comments";
import { ASSIGNMENT_ENTITY_TYPES } from "@/lib/store/assignments";

function isValidEntityType(value: unknown): value is CommentEntityType {
  return typeof value === "string" && (ASSIGNMENT_ENTITY_TYPES as readonly string[]).includes(value);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  if (!isValidEntityType(entityType) || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
  }

  const { orgId } = await getCurrentOrg();
  const comments = await getComments(orgId, entityType, entityId);
  return NextResponse.json({ comments });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const entityType = body.entityType;
  const entityId = typeof body.entityId === "string" ? body.entityId : "";
  const commentBody = typeof body.body === "string" ? body.body.trim() : "";
  const mentionedUserIds = Array.isArray(body.mentionedUserIds)
    ? body.mentionedUserIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  if (!isValidEntityType(entityType) || !entityId || !commentBody) {
    return NextResponse.json(
      { error: "entityType, entityId, and a non-empty body are required" },
      { status: 400 },
    );
  }

  const { orgId } = await getCurrentOrg();
  const userId = await getCurrentUserId();
  const comment = await createComment(orgId, entityType, entityId, userId, commentBody, mentionedUserIds);

  return NextResponse.json({ comment });
}
