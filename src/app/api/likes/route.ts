import { NextResponse } from "next/server";
import { getCurrentOrg, getCurrentUserId } from "@/lib/auth/session";
import { getLikeSummary, toggleLike, type LikeEntityType } from "@/lib/store/likes";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType") as LikeEntityType | null;
  const entityId = searchParams.get("entityId");

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
  }

  const { orgId } = await getCurrentOrg();
  const userId = await getCurrentUserId();
  const summary = await getLikeSummary(orgId, entityType, entityId, userId);
  return NextResponse.json(summary);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const entityType = body.entityType as LikeEntityType;
  const entityId = typeof body.entityId === "string" ? body.entityId : "";

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId are required" }, { status: 400 });
  }

  const { orgId } = await getCurrentOrg();
  const userId = await getCurrentUserId();
  const liked = await toggleLike(orgId, userId, entityType, entityId);
  const summary = await getLikeSummary(orgId, entityType, entityId, userId);

  return NextResponse.json({ liked, ...summary });
}
