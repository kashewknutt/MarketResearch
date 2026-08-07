import { NextRequest, NextResponse } from "next/server";
import { getLeadById, saveLeads } from "@/lib/store/leads";
import type { ContactStatus } from "@/lib/types/domain";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ lead });
}

const VALID_CONTACT_STATUSES: ContactStatus[] = [
  "not_contacted",
  "waiting_for_reply",
  "in_contact",
  "rejected",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));

  const updates: Partial<typeof lead> = {};
  if (VALID_CONTACT_STATUSES.includes(body.contactStatus)) {
    updates.contactStatus = body.contactStatus as ContactStatus;
  }
  if (typeof body.contactRemarks === "string") {
    updates.contactRemarks = body.contactRemarks.trim() || undefined;
  }

  const updated = { ...lead, ...updates };
  await saveLeads([updated]);

  return NextResponse.json({ lead: updated });
}
