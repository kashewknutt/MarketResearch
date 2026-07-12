import { NextRequest, NextResponse } from "next/server";
import { getAllLeads, saveLeads } from "@/lib/store/leads";
import { findDecisionMakerContact } from "@/lib/integrations/linkedin-people-search";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const leads = await getAllLeads();
  const lead = leads.find((l) => l.id === id);
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contact = await findDecisionMakerContact(lead.company);

  const updated = {
    ...lead,
    contactName: contact?.name,
    contactTitle: contact?.title,
    contactLinkedInUrl: contact?.profileUrl,
    outreachStatus: contact ? ("contact_found" as const) : lead.outreachStatus,
    outreachUpdatedAt: new Date().toISOString(),
  };
  await saveLeads([updated]);

  return NextResponse.json({ lead: updated, found: Boolean(contact) });
}
