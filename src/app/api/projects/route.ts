import { NextResponse } from "next/server";
import { getAllActiveProjects, getProjectById } from "@/lib/store/projects";
import { getProfile } from "@/lib/store/settings";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (id) {
    const project = await getProjectById(id);
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ project });
  }
  const projects = await getAllActiveProjects();
  const profile = await getProfile();
  return NextResponse.json({ projects, regions: profile?.regions ?? [] });
}
