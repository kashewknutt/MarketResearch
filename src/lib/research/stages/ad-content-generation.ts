import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { createProvenance } from "@/lib/db/provenance";
import { generatedAdContentPayloadSchema } from "@/lib/agents/validate";
import { GeminiApiError } from "@/lib/ai/gemini-errors";
import type { AdCreativeConstraints, AdIdea, GeneratedAdContent, OnboardingProfile } from "@/lib/types/domain";

const LONG_FORM_FORMATS = new Set(["long_video"]);

/** Default target runtime by format — the user needs fast, cheap 30-second ads by default. */
function defaultTargetDuration(format: string): string {
  if (LONG_FORM_FORMATS.has(format)) return "60-120 seconds (this format only, since it's long-form)";
  if (format === "carousel") return "5-7 quick slides, each readable in a couple seconds";
  return "~30 seconds";
}

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

  const targetDuration = defaultTargetDuration(idea.format);

  const result = await generateStructuredJson<Record<string, unknown>>({
    task: "ad_idea_content",
    systemInstruction:
      "Creative producer turning an ad/content idea into a shootable script and scene breakdown. " +
      "The creator needs FAST, cheap-to-produce ads — default to a ~30 second runtime unless the format " +
      "or the creator's own constraints call for something else. Respect the creator's real-world " +
      "constraints exactly (locations, budget, props available) — never suggest something they said " +
      "they can't do. JSON only.",
    userPrompt: `Business: ${profile.businessName} (${profile.serviceDomain}).

Idea to produce:
- Platform: ${idea.platform}
- Format: ${idea.format}
- Title: ${idea.title}
- Hook: ${idea.hook}
- Concept: ${idea.concept}
- Why this works: ${idea.whyThisWorks}

Creator's constraints (must be respected exactly, including any duration/length they specify — this overrides the default below): ${constraints.notes || "none provided"}

Target runtime unless the constraints above say otherwise: ${targetDuration}. Keep it to one hook, one clear point, and one call to action — this is a fast, cheap ad, not a mini-documentary.

Produce a complete, shootable package:
- "script": full narration/dialogue script as continuous text, sized to fit the target runtime
- "scenes": ordered scene-by-scene breakdown (2-4 scenes for a 30-second piece is typical — do not over-segment), each with a shot description, dialogue/on-screen text, and a realistic "durationSec" that sums to roughly the target runtime, respecting the stated constraints (e.g. if only one location is available, do not write scenes requiring other locations — substitute camera angles/props/editing tricks instead)
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
