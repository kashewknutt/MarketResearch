import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import { createProvenance } from "@/lib/db/provenance";
import { socialPlatformSchema, safeParse } from "@/lib/agents/validate";
import type {
  MarketingSocialSnapshot,
  OnboardingProfile,
  SocialPlatformStrategy,
} from "@/lib/types/domain";
import { SOCIAL_PLATFORMS } from "@/lib/types/domain";

export async function runSocialStrategy(
  profile: OnboardingProfile,
  jobId: string,
): Promise<MarketingSocialSnapshot> {
  const trace: AiCallTrace = {
    operation: "research.social_strategy",
    category: "research",
    correlationId: jobId,
    researchStage: "social_strategy",
  };

  const linked = profile.socialLinks ?? [];
  const presentPlatforms = SOCIAL_PLATFORMS.filter((p) =>
    linked.some((l) => l.platform.toLowerCase().includes(p.toLowerCase())),
  );
  const platformsToPlan =
    presentPlatforms.length > 0 ? presentPlatforms : [...SOCIAL_PLATFORMS.slice(0, 4)];

  const result = await generateStructuredJson<{
    platforms: Array<Record<string, unknown>>;
  }>({
    task: "social_strategy",
    systemInstruction:
      "Social media strategist for B2B services. Different playbook per platform. JSON only.",
    userPrompt: `Create social strategies for ${profile.businessName} (${profile.serviceDomain}).
Platforms: ${platformsToPlan.join(", ")}
Existing links: ${linked.map((l) => `${l.platform}: ${l.url}`).join(", ") || "none"}
Regions: ${profile.regions.join(", ")}

Return JSON: { "platforms": [{ "platform": string, "audience": string, "tone": string, "contentPillars": string[], "postingCadence": string, "differentiation": string (how this differs from other platforms), "kpis": [{ "label": string, "value": string }], "tactics": string[], "citations": [{ "title": string, "uri": string }] }] }`,
    useGoogleSearch: true,
    parse: (raw) => raw as { platforms: Array<Record<string, unknown>> },
    trace,
  });

  const platforms: SocialPlatformStrategy[] = (result.data.platforms ?? [])
    .map((p) => safeParse(socialPlatformSchema, p))
    .filter((p): p is SocialPlatformStrategy => p !== null);

  return {
    platforms,
    provenance: createProvenance("search", result.citations, 0.82),
  };
}
