import { NextResponse } from "next/server";
import { getCurrentOrg, getCurrentUserId } from "@/lib/auth/session";
import { getLikeSummaries, type LikeEntityType } from "@/lib/store/likes";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const entityType = body.entityType as LikeEntityType;
  const entityIds = Array.isArray(body.entityIds)
    ? body.entityIds.filter((id: unknown): id is string => typeof id === "string")
    : [];

  if (!entityType) {
    return NextResponse.json({ error: "entityType is required" }, { status: 400 });
  }

  const { orgId } = await getCurrentOrg();
  const userId = await getCurrentUserId();
  const summaries = await getLikeSummaries(orgId, entityType, entityIds, userId);

  return NextResponse.json({ summaries });
}
