import { NextResponse } from "next/server";
import { getDemandsByRegion } from "@/lib/store/demands";
import { getAllActiveProjects } from "@/lib/store/projects";
import { getProfile } from "@/lib/store/settings";
import { getSnapshot } from "@/lib/store/snapshots";

export async function GET() {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Not onboarded" }, { status: 404 });
  }

  const demandsByRegion: Record<string, Awaited<ReturnType<typeof getDemandsByRegion>>> = {};
  for (const region of profile.regions) {
    demandsByRegion[region] = await getDemandsByRegion(region);
  }

  const projects = await getAllActiveProjects();
  const domainSummary = await getSnapshot<{ summary: string }>("domain_summary");

  return NextResponse.json({
    profile,
    demandsByRegion,
    projects,
    domainSummary,
  });
}
