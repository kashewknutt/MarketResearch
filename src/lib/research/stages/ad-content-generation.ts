import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { createProvenance } from "@/lib/db/provenance";
import { generatedAdContentPayloadSchema } from "@/lib/agents/validate";
import { GeminiApiError } from "@/lib/ai/gemini-errors";
import type { AdCreativeConstraints, AdIdea, GeneratedAdContent, OnboardingProfile } from "@/lib/types/domain";

export async function generateIdeaContent(
  profile: OnboardingProfile,
  idea: AdIdea,
  constraints: AdCreativeConstraints,
  jobId: string,
): Promise<GeneratedAdContent> {
  const trace: AiCallTrace = {
    operation: "content.ad_idea_script",
    category: "research",
    correlationId: jobId,
    researchStage: "ad_trends",
  };

  const result = await generateStructuredJson<Record<string, unknown>>({
    task: "ad_idea_content",
    systemInstruction:
      "Creative producer turning an ad/content idea into a shootable script and scene breakdown. " +
      "Respect the creator's real-world constraints exactly (locations, budget, props available) — " +
      "never suggest something they said they can't do. JSON only.",
    userPrompt: `Business: ${profile.businessName} (${profile.serviceDomain}).

Idea to produce:
- Platform: ${idea.platform}
- Format: ${idea.format}
- Title: ${idea.title}
- Hook: ${idea.hook}
- Concept: ${idea.concept}
- Why this works: ${idea.whyThisWorks}

Creator's constraints (must be respected exactly): ${constraints.notes || "none provided"}

Produce a complete, shootable package:
- "script": full narration/dialogue script as continuous text
- "scenes": ordered scene-by-scene breakdown, each with a shot description and dialogue/on-screen text, respecting the stated constraints (e.g. if only one location is available, do not write scenes requiring other locations — substitute camera angles/props/editing tricks instead)
- "captionOrPost": the caption or post text ready to publish alongside this content
- "hashtags": relevant hashtags (without the # symbol)
- "assetNotes": brief notes on how to work around the stated constraints (prop substitutions, single-location blocking, etc.)

Return JSON:
{
  "script": string,
  "scenes": [{ "order": number, "shot": string, "dialogueOrText": string, "durationSec": number, "notes": string }],
  "captionOrPost": string,
  "hashtags": string[],
  "assetNotes": string
}`,
    useGoogleSearch: false,
    parse: (raw) => raw as Record<string, unknown>,
    trace,
  });

  const parsed = generatedAdContentPayloadSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new GeminiApiError(
      "parse_error",
      "The AI returned an unexpected response while generating content. Try again.",
      `generatedAdContentPayloadSchema validation failed: ${parsed.error.message}`,
    );
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    constraints,
    script: parsed.data.script,
    scenes: parsed.data.scenes,
    captionOrPost: parsed.data.captionOrPost,
    hashtags: parsed.data.hashtags,
    assetNotes: parsed.data.assetNotes,
    provenance: createProvenance("ai", result.citations, 0.75),
  };
}
