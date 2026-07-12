import { NextResponse } from "next/server";
import { getCurrentOrg, getCurrentUserId } from "@/lib/auth/session";
import { getOrg, getOrgMembers } from "@/lib/store/orgs";

export async function GET() {
  const { orgId, role } = await getCurrentOrg();
  const userId = await getCurrentUserId();
  const org = await getOrg(orgId);
  const members = await getOrgMembers(orgId);

  return NextResponse.json({
    org: org ? { id: org.id, name: org.name, slug: org.slug } : null,
    role,
    currentUserId: userId,
    members,
  });
}
