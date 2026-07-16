import { NextResponse } from "next/server";
import { createProvenance } from "@/lib/db/provenance";
import { newLeadId, saveLeads } from "@/lib/store/leads";
import type { LeadRecord, LeadStatus } from "@/lib/types/domain";

const LEAD_STATUSES: LeadStatus[] = ["new", "qualified", "contacted", "archived"];

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const company = requiredString(body.company);
  const region = requiredString(body.region);
  const whyFit = requiredString(body.whyFit);
  const contactHints = requiredString(body.contactHints) ?? "";
  const fitScore = Number(body.fitScore);
  const status: LeadStatus = LEAD_STATUSES.includes(body.status) ? body.status : "new";

  if (
    !company ||
    !region ||
    !whyFit ||
    !Number.isFinite(fitScore) ||
    fitScore < 0 ||
    fitScore > 100
  ) {
    return NextResponse.json(
      { error: "company, region, whyFit, and a fitScore between 0 and 100 are required" },
      { status: 400 },
    );
  }

  const lead: LeadRecord = {
    id: newLeadId(),
    company,
    region,
    fitScore,
    signals: [],
    contactHints,
    whyFit,
    sources: [],
    status,
    provenance: createProvenance("user", []),
    createdAt: new Date().toISOString(),
    contactName: optionalString(body.contactName),
    contactTitle: optionalString(body.contactTitle),
    contactLinkedInUrl: optionalString(body.contactLinkedInUrl),
    source: "discovery",
  };

  await saveLeads([lead]);

  return NextResponse.json({ lead }, { status: 201 });
}
