import { NextRequest, NextResponse } from "next/server";
import { getAllLeads, saveLeads } from "@/lib/store/leads";
import { getProfile } from "@/lib/store/settings";
import { draftOutreachMessage } from "@/lib/research/stages/lead-outreach";

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not onboarded" }, { status: 404 });
  }

  const leads = await getAllLeads();
  const lead = leads.find((l) => l.id === id);
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const context = requiredString(body.context) ?? undefined;

  const message = await draftOutreachMessage(profile, lead, context);

  const updated = {
    ...lead,
    outreachMessage: message,
    outreachStatus: "drafted" as const,
    outreachUpdatedAt: new Date().toISOString(),
  };
  await saveLeads([updated]);

  return NextResponse.json({ lead: updated });
}
