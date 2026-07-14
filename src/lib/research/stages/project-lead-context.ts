import { randomUUID } from "crypto";
import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import {
  projectCategoryInsightsSchema,
  projectClassifySchema,
  projectLeadDiscoverySchema,
  projectOpeningMessagesSchema,
  safeParse,
} from "@/lib/agents/validate";
import { createProvenance } from "@/lib/db/provenance";
import { getProjectById, saveProject } from "@/lib/store/projects";
import {
  getAllLeads,
  newLeadId,
  normalizeCompanyName,
  saveLeads,
} from "@/lib/store/leads";
import type {
  LeadRecord,
  MarketProject,
  OnboardingProfile,
  ProjectLeadCategory,
  ProjectLeadContext,
} from "@/lib/types/domain";
import {
  PROJECT_LEAD_PROGRESS_STAGES,
  type ProjectLeadProgressStage,
  type ProjectLeadProgressStageId,
} from "@/lib/project-lead-labels";

const CATEGORY_LABELS: Record<ProjectLeadCategory, string> = {
  already_using: "Already using similar solutions or approaches",
  in_need: "In dire need of this project or implementation",
  would_benefit: "Would benefit from this even if not actively pursuing it",
};

export interface ProjectLeadContextResult {
  project: MarketProject;
  newLeads: LeadRecord[];
}

export type {
  ProjectLeadProgressStage,
  ProjectLeadProgressStageId,
} from "@/lib/project-lead-labels";

export interface ProjectLeadProgressUpdate {
  progress: number;
  message: string;
  stages: ProjectLeadProgressStage[];
}

export type ProjectLeadProgressCallback = (
  update: ProjectLeadProgressUpdate,
) => void;

function stageStates(
  activeId: ProjectLeadProgressStageId | null,
  completedIds: ProjectLeadProgressStageId[],
  failedId?: ProjectLeadProgressStageId,
): ProjectLeadProgressStage[] {
  return PROJECT_LEAD_PROGRESS_STAGES.map((stage) => ({
    ...stage,
    status: failedId === stage.id
      ? "failed"
      : completedIds.includes(stage.id)
        ? "completed"
        : activeId === stage.id
          ? "running"
          : "pending",
  }));
}

function reportProgress(
  onProgress: ProjectLeadProgressCallback | undefined,
  activeId: ProjectLeadProgressStageId | null,
  completedIds: ProjectLeadProgressStageId[],
  progress: number,
  message: string,
) {
  onProgress?.({
    progress,
    message,
    stages: stageStates(activeId, completedIds),
  });
}

function projectContext(project: MarketProject): string {
  return [
    `Title: ${project.title}`,
    `Summary: ${project.summary}`,
    `Explanation: ${project.explanation}`,
    project.rationale ? `Rationale: ${project.rationale}` : "",
    project.challenges?.length
      ? `Challenges: ${project.challenges.join("; ")}`
      : "",
    project.solutions?.length ? `Solutions: ${project.solutions.join("; ")}` : "",
    `Region: ${project.region}`,
    `Ticket size: ${project.currency} ${project.ticketSize}`,
    `Expected value: ${project.expectedValue}`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function classifyProject(
  profile: OnboardingProfile,
  project: MarketProject,
  trace: AiCallTrace,
) {
  const result = await generateStructuredJson({
    task: "project_lead_classify",
    systemInstruction:
      "Market research analyst. Extract keywords, market categories, and industries for a project opportunity. JSON only.",
    userPrompt: `Business: ${profile.businessName} (${profile.serviceDomain})
Target audience: ${profile.targetAudience}

Project opportunity:
${projectContext(project)}

Return JSON: { "keywords": string[], "categories": string[], "industries": string[] }`,
    parse: (raw) => {
      const parsed = safeParse(projectClassifySchema, raw);
      if (!parsed) throw new Error("Invalid project classification response");
      return parsed;
    },
    trace,
  });

  return { data: result.data, citations: result.citations };
}

async function discoverProjectLeads(
  profile: OnboardingProfile,
  project: MarketProject,
  classification: { keywords: string[]; categories: string[]; industries: string[] },
  knownCompanies: string[],
  trace: AiCallTrace,
) {
  const result = await generateStructuredJson({
    task: "project_lead_discovery",
    systemInstruction:
      "B2B lead researcher. Find real companies for a specific project opportunity. JSON only. Cite sources.",
    userPrompt: `Business: ${profile.businessName} (${profile.serviceDomain})
Target audience: ${profile.targetAudience}

Project opportunity in ${project.region}:
${projectContext(project)}

Keywords: ${classification.keywords.join(", ")}
Categories: ${classification.categories.join(", ")}
Industries: ${classification.industries.join(", ")}

Find exactly 9 companies in ${project.region}, 3 per category:
- already_using: ${CATEGORY_LABELS.already_using}
- in_need: ${CATEGORY_LABELS.in_need}
- would_benefit: ${CATEGORY_LABELS.would_benefit}

${knownCompanies.length > 0 ? `Do NOT repeat any of these companies (already in our leads list): ${knownCompanies.join(", ")}\n` : ""}
For each company explain why they fit this category relative to the project.

Return JSON: { "leads": [{ "company": string, "region": "${project.region}", "category": "already_using"|"in_need"|"would_benefit", "fitScore": number, "signals": string[], "contactHints": string, "whyFit": string, "whyPerfect": string, "pitchOutline": string, "contactPlan": string, "objections": string[], "sources": [{ "title": string, "uri": string }] }] }`,
    useGoogleSearch: true,
    parse: (raw) => {
      const parsed = safeParse(projectLeadDiscoverySchema, raw);
      if (!parsed) throw new Error("Invalid project lead discovery response");
      return parsed;
    },
    trace,
  });

  return { data: result.data, citations: result.citations };
}

async function generateCategoryInsights(
  profile: OnboardingProfile,
  project: MarketProject,
  classification: { keywords: string[]; categories: string[]; industries: string[] },
  trace: AiCallTrace,
) {
  const result = await generateStructuredJson({
    task: "project_lead_category_insights",
    systemInstruction:
      "B2B sales strategist. Think from the CEO's perspective for each lead category. JSON only.",
    userPrompt: `Seller: ${profile.businessName} (${profile.serviceDomain})
Strategic goals: ${profile.strategicGoals || "Grow revenue"}
Target audience: ${profile.targetAudience}

Project opportunity:
${projectContext(project)}

Keywords: ${classification.keywords.join(", ")}
Categories: ${classification.categories.join(", ")}
Industries: ${classification.industries.join(", ")}

For each lead category, answer:
1. What is the CEO thinking right now about solving this project/implementation?
2. What are the top 10 problems on the CEO's mind (specific to this category)?
3. How can ${profile.businessName}'s services (${profile.serviceDomain}) map to solving those problems?

Categories (return exactly one insight object per category):
- already_using: companies already using similar solutions
- in_need: companies in dire need of this project
- would_benefit: companies that would benefit even if not actively pursuing it

Return JSON: { "insights": [{ "category": "already_using"|"in_need"|"would_benefit", "ceoThinking": string, "topProblems": string[10], "serviceMapping": string }] }`,
    parse: (raw) => {
      const parsed = safeParse(projectCategoryInsightsSchema, raw);
      if (!parsed) throw new Error("Invalid category insights response");
      return parsed;
    },
    trace,
  });

  return result.data;
}

async function generateOpeningMessages(
  profile: OnboardingProfile,
  project: MarketProject,
  lead: LeadRecord,
  categoryInsight: ProjectLeadContext["categoryInsights"][number] | undefined,
  trace: AiCallTrace,
): Promise<string[]> {
  const result = await generateStructuredJson({
    task: "project_lead_opening_messages",
    systemInstruction:
      "You write short, specific, non-salesy LinkedIn outreach opening messages. Never write generic filler. JSON only.",
    userPrompt: `Sender: ${profile.businessName} (${profile.serviceDomain})

Project: ${project.title}
Project summary: ${project.summary}

Lead: ${lead.company}
Category: ${lead.projectLeadCategory ?? "unknown"}
Why fit: ${lead.whyFit}
${lead.pitchOutline ? `Pitch angle: ${lead.pitchOutline}\n` : ""}${categoryInsight ? `CEO mindset: ${categoryInsight.ceoThinking}\nTop problems: ${categoryInsight.topProblems.join("; ")}\nService mapping: ${categoryInsight.serviceMapping}\n` : ""}
Write 5 distinct opening messages (2-4 sentences each), specific to this lead and project. Soft CTA, no "Hi there" boilerplate.

Return JSON: { "messages": string[5] }`,
    parse: (raw) => {
      const parsed = safeParse(projectOpeningMessagesSchema, raw);
      if (!parsed) throw new Error("Invalid opening messages response");
      return parsed;
    },
    trace,
  });

  return result.data.messages;
}

export async function runProjectLeadContext(
  profile: OnboardingProfile,
  projectId: string,
  onProgress?: ProjectLeadProgressCallback,
): Promise<ProjectLeadContextResult> {
  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  const correlationId = randomUUID();
  const baseTrace: AiCallTrace = {
    operation: "research.project_lead_context",
    category: "research",
    correlationId,
    region: project.region,
    researchStage: "project_leads",
  };

  const existingLeads = await getAllLeads();
  const knownCompanyNames = new Set(
    existingLeads.map((l) => normalizeCompanyName(l.company)),
  );
  const knownCompanies = existingLeads.map((l) => l.company);

  reportProgress(onProgress, "classify", [], 5, "Classifying project keywords and industries…");

  const classifyResult = await classifyProject(profile, project, {
    ...baseTrace,
    operation: "research.project_lead_classify",
  });

  reportProgress(onProgress, "discover", ["classify"], 25, "Finding companies in each category…");

  const discoverResult = await discoverProjectLeads(
    profile,
    project,
    classifyResult.data,
    knownCompanies,
    {
      ...baseTrace,
      operation: "research.project_lead_discovery",
    },
  );

  reportProgress(
    onProgress,
    "insights",
    ["classify", "discover"],
    50,
    "Mapping CEO problems to your services…",
  );

  const insightsResult = await generateCategoryInsights(
    profile,
    project,
    classifyResult.data,
    {
      ...baseTrace,
      operation: "research.project_lead_insights",
    },
  );

  const allCitations = [
    ...classifyResult.citations,
    ...discoverResult.citations,
  ];

  const newLeads: LeadRecord[] = [];
  const seenThisRun = new Set<string>();

  for (const raw of discoverResult.data.leads) {
    const normalized = normalizeCompanyName(raw.company);
    if (knownCompanyNames.has(normalized) || seenThisRun.has(normalized)) {
      continue;
    }
    seenThisRun.add(normalized);
    knownCompanyNames.add(normalized);

    newLeads.push({
      id: newLeadId(),
      company: raw.company,
      region: raw.region as LeadRecord["region"],
      fitScore: raw.fitScore,
      signals: raw.signals,
      contactHints: raw.contactHints,
      whyFit: raw.whyFit,
      whyPerfect: raw.whyPerfect,
      pitchOutline: raw.pitchOutline,
      contactPlan: raw.contactPlan,
      objections: raw.objections,
      sources: raw.sources,
      status: "new",
      provenance: createProvenance("search", discoverResult.citations, 0.75),
      createdAt: new Date().toISOString(),
      source: "project",
      projectId: project.id,
      projectTitle: project.title,
      projectLeadCategory: raw.category,
    });
  }

  reportProgress(
    onProgress,
    "messages",
    ["classify", "discover", "insights"],
    65,
    newLeads.length > 0
      ? `Writing opening messages for ${newLeads.length} leads…`
      : "Finalizing project context…",
  );

  for (let i = 0; i < newLeads.length; i++) {
    const lead = newLeads[i];
    const categoryInsight = insightsResult.insights.find(
      (item) => item.category === lead.projectLeadCategory,
    );
    lead.openingMessages = await generateOpeningMessages(
      profile,
      project,
      lead,
      categoryInsight,
      {
        ...baseTrace,
        operation: "research.project_lead_opening_messages",
      },
    );

    if (newLeads.length > 0) {
      const messageProgress = 65 + Math.round(((i + 1) / newLeads.length) * 30);
      reportProgress(
        onProgress,
        "messages",
        ["classify", "discover", "insights"],
        messageProgress,
        `Writing opening messages (${i + 1} of ${newLeads.length})…`,
      );
    }
  }

  if (newLeads.length > 0) {
    await saveLeads(newLeads);
  }

  const existingLeadIds = project.projectLeadContext?.leadIds ?? [];
  const mergedLeadIds = [
    ...existingLeadIds,
    ...newLeads.map((l) => l.id),
  ];

  const updatedProject: MarketProject = {
    ...project,
    projectLeadContext: {
      keywords: classifyResult.data.keywords,
      categories: classifyResult.data.categories,
      industries: classifyResult.data.industries,
      categoryInsights: insightsResult.insights,
      leadIds: mergedLeadIds,
      generatedAt: new Date().toISOString(),
      provenance: createProvenance("search", allCitations, 0.8),
    },
  };

  await saveProject(updatedProject, 0);

  reportProgress(
    onProgress,
    null,
    ["classify", "discover", "insights", "messages"],
    100,
    "Lead generation complete.",
  );

  return { project: updatedProject, newLeads };
}
