import { NextResponse } from "next/server";
import { getProfile } from "@/lib/store/settings";
import { getLeadsByIds, getLeadsByProjectId, getLeadsPage } from "@/lib/store/leads";
import { runLeadDiscovery } from "@/lib/research/stages/lead-discovery";
import { randomUUID } from "crypto";

const DEFAULT_PAGE_SIZE = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const idsParam = searchParams.get("ids");
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const leads = await getLeadsByIds(ids);
    return NextResponse.json({ leads, total: leads.length });
  }

  const projectId = searchParams.get("projectId");
  if (projectId) {
    const leads = await getLeadsByProjectId(projectId);
    return NextResponse.json({ leads, total: leads.length });
  }

  const offset = Math.max(0, Number(searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE));

  const { leads, total } = await getLeadsPage(offset, limit);
  return NextResponse.json({ leads, total, offset, limit });
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
