import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { createProvenance } from "@/lib/db/provenance";
import { runPipeline } from "@/lib/agents/pipeline";
import { enrichedProjectSchema, safeParse } from "@/lib/agents/validate";
import { fetchRedditSignals } from "@/lib/integrations/reddit";
import type { Citation, MarketProject, OnboardingProfile } from "@/lib/types/domain";
import { getProjectsByRegion, saveProject } from "@/lib/store/projects";
import { getDb } from "@/lib/db/client";
import { projects as projectsTable } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";
import { and, eq } from "drizzle-orm";

function mergeCitations(...groups: Citation[][]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of groups.flat()) {
    const key = `${c.uri ?? ""}|${c.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

interface Ctx {
  profile: OnboardingProfile;
  project: MarketProject;
  integrationNotes: string[];
}

export async function enrichProjectsForRegion(
  profile: OnboardingProfile,
  region: string,
  jobId: string,
): Promise<void> {
  const projects = await getProjectsByRegion(region, "active");
  const trace: AiCallTrace = {
    operation: `research.enrich_projects_${region}`,
    category: "research",
    correlationId: jobId,
    region,
    researchStage: "project_enrichment",
  };

  for (const project of projects) {
    const ctx = await runPipeline<Ctx>(
      [
        {
          id: "integrations",
          label: "Fetch integration signals",
          run: async (c) => {
            const reddit = await fetchRedditSignals(
              `${c.profile.serviceDomain} ${c.project.title} ${region}`,
              3,
            );
            const notes = reddit.map((r) => `[Reddit] ${r.title}: ${r.snippet}`);
            return { ...c, integrationNotes: notes };
          },
        },
        {
          id: "synthesize",
          label: "Enrich project with evidence",
          run: async (c) => {
            const result = await generateStructuredJson({
              task: `enrich_project_${c.project.id}`,
              systemInstruction:
                "Market analyst. Return JSON only. Every pricing claim needs citations with uri.",
              userPrompt: `Enrich this service opportunity for ${profile.businessName} (${profile.serviceDomain}) in ${region}.
Project: ${c.project.title}
Summary: ${c.project.summary}
Currency: ${profile.currency}
Integration signals:
${c.integrationNotes.join("\n") || "None"}

Return JSON:
{
  "rationale": string (why suggest this now, with numbers),
  "challenges": string[],
  "solutions": string[],
  "regionalPricing": [{ "region": string, "min": number, "median": number, "max": number, "currency": string, "willingnessNote": string, "citations": [{ "title": string, "uri": string }] }],
  "precedents": [{ "company": string, "action": string, "reportedResult": string, "metric": string, "sourceUri": string }],
  "confidenceScore": number (0-1)
}`,
              useGoogleSearch: true,
              parse: (raw) => raw as Record<string, unknown>,
              trace,
            });

            const parsed = safeParse(enrichedProjectSchema, result.data);
            const precedents = parsed?.precedents ?? [];
            const regionalPricing = parsed?.regionalPricing ?? [];
            const fromPrecedents: Citation[] = precedents
              .filter((p) => p.sourceUri)
              .map((p) => ({
                title: p.sourceTitle ?? `${p.company} precedent`,
                uri: p.sourceUri,
              }));
            const fromPricing = regionalPricing.flatMap((rp) => rp.citations);
            const citations = mergeCitations(
              result.citations,
              fromPricing,
              fromPrecedents,
            );
            const hasUrl = citations.some((x) => x.uri?.trim());
            const hasPrecedentEvidence =
              precedents.length > 0 || regionalPricing.length > 0;

            let explanation = c.project.explanation;
            if (!hasUrl && hasPrecedentEvidence) {
              explanation = `${explanation}\n\nNo traceable URLs in search results; see precedent and regional pricing evidence below.`;
            } else if (!hasUrl && !hasPrecedentEvidence) {
              explanation = `${explanation}\n\nLimited public evidence — estimates are AI-assisted; re-run research after adding integrations.`;
            }

            const enriched: MarketProject = {
              ...c.project,
              rationale: parsed?.rationale ?? String(result.data.rationale ?? ""),
              challenges: parsed?.challenges ?? [],
              solutions: parsed?.solutions ?? [],
              regionalPricing,
              precedents,
              confidenceScore: parsed?.confidenceScore ?? 0.7,
              pipelineSteps: ["integrations", "synthesize"],
              explanation,
              provenance: createProvenance(
                hasUrl ? "search" : "ai",
                citations,
                hasUrl ? 0.85 : 0.55,
              ),
            };
            const userId = await getCurrentUserId();
            const db = getDb();
            const row = await db
              .select()
              .from(projectsTable)
              .where(
                and(
                  eq(projectsTable.userId, userId),
                  eq(projectsTable.id, enriched.id),
                ),
              )
              .limit(1);
            const sortOrder = row[0]?.sortOrder ?? 0;
            await saveProject(enriched, sortOrder);
            return { ...c, project: enriched };
          },
        },
      ],
      { profile, project, integrationNotes: [] },
      { jobId, stageId: "project_enrichment" },
    );
    void ctx;
  }
}
