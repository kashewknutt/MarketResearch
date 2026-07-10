import { NextResponse } from "next/server";
import { getCurrentOrg, getCurrentUserId } from "@/lib/auth/session";
import { addMemberByEmail, MemberNotRegisteredError } from "@/lib/store/orgs";

export async function POST(request: Request) {
  const { orgId, role } = await getCurrentOrg();
  if (role !== "owner") {
    return NextResponse.json({ error: "Only the org owner can add members" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const invitedBy = await getCurrentUserId();

  try {
    const member = await addMemberByEmail(orgId, email, invitedBy, "member");
    return NextResponse.json({ member });
  } catch (err) {
    if (err instanceof MemberNotRegisteredError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    throw err;
  }
}
