import { NextResponse } from "next/server";
import { getCurrentOrg, getCurrentUserId } from "@/lib/auth/session";
import { getMentionsForUser } from "@/lib/store/comments";

export async function GET() {
  const { orgId } = await getCurrentOrg();
  const userId = await getCurrentUserId();
  const mentions = await getMentionsForUser(orgId, userId);
  return NextResponse.json({ mentions });
}
