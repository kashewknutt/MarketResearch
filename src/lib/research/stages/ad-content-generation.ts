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

const LIGHT_BY_TIME: Record<string, string> = {
  "Early morning": "soft, cool, low-angle natural light — often dim, may need lamp fill",
  Morning: "bright, fresh natural light",
  Midday: "the strongest, most direct natural light of the day",
  Afternoon: "warm, angled natural light, softening toward evening",
  Evening: "warm, dim golden light fading fast — likely needs lamp/LED fill",
  Night: "no natural light at all — entirely dependent on lamp/artificial lighting",
};

function describeTimeOfDay(timeOfDay?: string): string {
  if (!timeOfDay) return "";
  const description = LIGHT_BY_TIME[timeOfDay];
  return `\nShoot time: ${timeOfDay}${description ? ` (${description})` : ""}. Reflect this realistically wherever lighting is mentioned — don't dwell on it unless it actually matters for a specific shot.`;
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
      "or the creator's own constraints call for something else. The creator's listed setup is a MENU of " +
      "resources available, not a checklist to force into every scene — use only what a real editor would " +
      "actually reach for, and leave the rest unmentioned. Mix genuine on-camera narration with other visuals " +
      "(screen recordings, b-roll, graphics) the way a real short-form ad would, not 100% talking head. JSON only.",
    userPrompt: `Business: ${profile.businessName} (${profile.serviceDomain}).

Idea to produce:
- Platform: ${idea.platform}
- Format: ${idea.format}
- Title: ${idea.title}
- Hook: ${idea.hook}
- Concept: ${idea.concept}
- Why this works: ${idea.whyThisWorks}

Creator's available setup (a menu of real resources — NOT a checklist to force into every scene; most scenes should reference none of it): ${constraints.notes || "none provided"}${describeTimeOfDay(constraints.timeOfDay)}

Target runtime unless the constraints above say otherwise: ${targetDuration}. Keep it to one hook, one clear point, and one call to action — this is a fast, cheap ad, not a mini-documentary.

Make this feel like a real, human-made ad, not a spec sheet:
- Do NOT try to mention the creator's props/decor/lighting in every scene, or even most scenes. Only bring one in when it's genuinely what a real shot would show — most scenes need zero references to the setup list.
- Vary what's actually ON SCREEN across scenes rather than defaulting to the creator talking to camera the whole time. Where it strengthens the message, describe a scene as something other than the creator on camera — e.g. a screen recording ("mockup of an AI dashboard on screen"), a b-roll concept ("b-roll: a manager buried in spreadsheets", "quick cut of a team messaging app lighting up"), an on-screen graphic/text comparison, or similar. A natural pattern for a 30s ad is: hook on camera, 1-2 scenes cut to supporting visuals that sell the point, close back on camera for the call to action — but adapt this to what actually sells THIS idea.
- Keep each scene's "notes" field sparse — leave it empty unless one specific, non-obvious real-world detail genuinely matters for that exact shot (e.g. only mention the lamp if that scene is on-camera in low light). Do not use "notes" to list decor items just because they exist.

Produce a complete, shootable package:
- "script": full narration/dialogue script as continuous text, sized to fit the target runtime
- "scenes": ordered scene-by-scene breakdown (2-4 scenes for a 30-second piece is typical — do not over-segment). Each scene's "shot" field must say what is actually ON SCREEN (on-camera narration, OR a specific non-creator visual per the guidance above), "dialogueOrText" is the narration/on-screen text for that moment, and "durationSec" should be realistic and sum to roughly the target runtime.
- "captionOrPost": the caption or post text ready to publish alongside this content
- "hashtags": relevant hashtags (without the # symbol)
- "assetNotes": only genuinely useful notes on working within real constraints (e.g. a location or prop substitution) — leave brief or empty if nothing non-obvious applies, do not pad this with a recap of the setup list

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
