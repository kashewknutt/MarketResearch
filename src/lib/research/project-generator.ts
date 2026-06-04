import { randomUUID } from "crypto";
import { generateStructuredJson } from "@/lib/ai/gemini";
import { projectsPrompt } from "@/lib/ai/prompts";
import { createProvenance } from "@/lib/db/provenance";
import {
  clearProjectsForRegion,
  countActiveByRegion,
  getProjectsByRegion,
  saveProject,
} from "@/lib/store/projects";
import type { MarketProject, OnboardingProfile, RegionCode } from "@/lib/types/domain";
import { PROJECTS_PER_REGION } from "@/lib/types/domain";

interface RawProject {
  title: string;
  summary: string;
  explanation: string;
  ticketSize: number;
  currency: string;
  effort: "low" | "medium" | "high";
  expectedValue: string;
  nextStep: string;
}

async function fetchProjectsFromAi(
  profile: OnboardingProfile,
  region: RegionCode,
  count: number,
  excludeTitles: string[],
  correlationId?: string,
): Promise<MarketProject[]> {
  const result = await generateStructuredJson<{ projects: RawProject[] }>({
    task: `projects_${region}`,
    systemInstruction: `You are a market research analyst for service businesses. Current year: ${new Date().getFullYear()}.`,
    userPrompt: projectsPrompt(profile, region, count, excludeTitles),
    useGoogleSearch: true,
    parse: (raw) => {
      const obj = raw as { projects?: RawProject[] };
      if (!Array.isArray(obj.projects)) throw new Error("Invalid projects");
      return { projects: obj.projects };
    },
    trace: {
      operation: correlationId
        ? `research.projects_${region}`
        : `projects.replace_${region}`,
      category: correlationId ? "research" : "projects",
      correlationId,
      region,
      researchStage: correlationId ? "regional_projects" : undefined,
      metadata: {
        count: String(count),
        trigger: correlationId ? "research_pipeline" : "mark_done",
      },
    },
  });

  const currency = region === "India" ? "INR" : "USD";
  return result.data.projects.map((p) => ({
    id: randomUUID(),
    region,
    title: p.title,
    summary: p.summary,
    explanation: p.explanation,
    ticketSize: p.ticketSize,
    currency: p.currency || currency,
    effort: p.effort,
    expectedValue: p.expectedValue,
    nextStep: p.nextStep,
    status: "active" as const,
    provenance: {
      ...createProvenance("search", result.citations, 0.8),
    },
  }));
}

export async function generateProjectsForRegion(
  profile: OnboardingProfile,
  region: RegionCode,
  count: number,
  replace = false,
  correlationId?: string,
): Promise<MarketProject[]> {
  if (replace) await clearProjectsForRegion(region);

  const existing = await getProjectsByRegion(region, "active");
  const excludeTitles = existing.map((p) => p.title);
  const needed = replace ? count : Math.max(0, count - existing.length);

  if (needed <= 0) return existing;

  const newProjects = await fetchProjectsFromAi(
    profile,
    region,
    needed,
    excludeTitles,
    correlationId,
  );

  const startOrder = existing.length;
  for (let i = 0; i < newProjects.length; i++) {
    await saveProject(newProjects[i], startOrder + i);
  }

  return [...existing, ...newProjects];
}

export async function ensureFullProjectQueues(
  profile: OnboardingProfile,
  correlationId?: string,
): Promise<void> {
  for (const region of profile.regions) {
    const active = await countActiveByRegion(region);
    if (active < PROJECTS_PER_REGION) {
      await generateProjectsForRegion(
        profile,
        region,
        PROJECTS_PER_REGION - active,
        false,
        correlationId,
      );
    }
  }
}

export async function replaceCompletedProject(
  profile: OnboardingProfile,
  region: RegionCode,
): Promise<MarketProject | null> {
  const active = await countActiveByRegion(region);
  if (active >= PROJECTS_PER_REGION) return null;

  const created = await generateProjectsForRegion(
    profile,
    region,
    1,
    false,
    undefined,
  );
  return created[created.length - 1] ?? null;
}
