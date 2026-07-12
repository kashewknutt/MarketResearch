import { NextRequest, NextResponse } from "next/server";
import { getAllLeads, saveLeads } from "@/lib/store/leads";

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

  const updated = {
    ...lead,
    outreachStatus: "sent" as const,
    outreachUpdatedAt: new Date().toISOString(),
  };
  await saveLeads([updated]);

  return NextResponse.json({ lead: updated });
}
