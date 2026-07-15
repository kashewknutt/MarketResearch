import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import {
  getAllActiveProjects,
  getProjectById,
  getProjectsByRegion,
  saveProject,
} from "@/lib/store/projects";
import { getProfile } from "@/lib/store/settings";
import { createProvenance } from "@/lib/db/provenance";
import type { MarketProject } from "@/lib/types/domain";

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

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const region = requiredString(body.region);
  const title = requiredString(body.title);
  const summary = requiredString(body.summary);
  const explanation = requiredString(body.explanation);
  const expectedValue = requiredString(body.expectedValue);
  const nextStep = requiredString(body.nextStep);
  const currency = requiredString(body.currency) ?? "USD";
  const effort = body.effort;
  const ticketSize = Number(body.ticketSize);

  if (
    !region ||
    !title ||
    !summary ||
    !explanation ||
    !expectedValue ||
    !nextStep ||
    !Number.isFinite(ticketSize) ||
    ticketSize < 0 ||
    !["low", "medium", "high"].includes(effort)
  ) {
    return NextResponse.json(
      {
        error:
          "region, title, summary, explanation, expectedValue, nextStep, a non-negative ticketSize, and a valid effort are required",
      },
      { status: 400 },
    );
  }

  const project: MarketProject = {
    id: randomUUID(),
    region,
    title,
    summary,
    explanation,
    ticketSize,
    currency,
    effort,
    expectedValue,
    nextStep,
    status: "active",
    provenance: createProvenance("user", []),
    rationale: requiredString(body.rationale) ?? undefined,
  };

  const existing = await getProjectsByRegion(region, "active");
  await saveProject(project, existing.length);

  return NextResponse.json({ project }, { status: 201 });
}
