import { NextRequest, NextResponse } from "next/server";
import { getProjectById, saveProject } from "@/lib/store/projects";
import type { MarketProject } from "@/lib/types/domain";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ project });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await getProjectById(id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = (await request.json()) as Partial<MarketProject>;
  const updated: MarketProject = {
    ...existing,
    ...body,
    provenance: body.provenance ?? {
      ...existing.provenance,
      source: "user" as const,
      isUserEdited: true,
      overrideHistory: [
        ...existing.provenance.overrideHistory,
        { value: existing, at: new Date().toISOString() },
      ],
    },
  };
  await saveProject(updated, 0);
  return NextResponse.json({ project: updated });
}
