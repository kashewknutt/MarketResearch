import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/auth/session";
import { removeMember } from "@/lib/store/orgs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { orgId, role } = await getCurrentOrg();
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the org owner can remove members" }, { status: 403 });
  }

  const { userId } = await params;
  await removeMember(orgId, userId);
  return NextResponse.json({ ok: true });
}
