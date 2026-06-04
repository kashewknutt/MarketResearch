import { NextResponse } from "next/server";
import { getProfile } from "@/lib/store/settings";
import { getAllLeads } from "@/lib/store/leads";
import { runLeadDiscovery } from "@/lib/research/stages/lead-discovery";
import { randomUUID } from "crypto";

export async function GET() {
  const leads = await getAllLeads();
  return NextResponse.json({ leads });
}

export async function POST() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not onboarded" }, { status: 404 });
  }

  const jobId = randomUUID();
  const leads = await runLeadDiscovery(profile, jobId);
  return NextResponse.json({ leads, jobId });
}
