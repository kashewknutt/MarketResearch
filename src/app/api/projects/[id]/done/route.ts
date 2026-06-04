import { NextRequest, NextResponse } from "next/server";
import { isGeminiApiError } from "@/lib/ai/gemini-errors";
import { replaceCompletedProject } from "@/lib/research/project-generator";
import { getProjectById, saveProject } from "@/lib/store/projects";
import { getProfile } from "@/lib/store/settings";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const project = await getProjectById(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const completed = {
    ...project,
    status: "done" as const,
    completedAt: new Date().toISOString(),
  };
  await saveProject(completed, 0);

  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ project: completed, replacement: null });
  }

  try {
    const replacement = await replaceCompletedProject(profile, project.region);
    return NextResponse.json({ project: completed, replacement });
  } catch (err) {
    if (isGeminiApiError(err)) {
      return NextResponse.json(
        {
          project: completed,
          replacement: null,
          error: err.code,
          message: err.userMessage,
        },
        { status: 503 },
      );
    }
    throw err;
  }
}
