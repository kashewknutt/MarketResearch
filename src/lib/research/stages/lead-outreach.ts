import { randomUUID } from "crypto";
import { generateStructuredJson } from "@/lib/ai/gemini";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import type { LeadRecord, OnboardingProfile } from "@/lib/types/domain";

/**
 * Drafts a short, specific, non-salesy outreach message for a single lead, grounded in
 * whatever context was already generated for it during lead discovery — never generic filler.
 */
export async function draftOutreachMessage(
  profile: OnboardingProfile,
  lead: LeadRecord,
): Promise<string> {
  const trace: AiCallTrace = {
    operation: "research.lead_outreach_message",
    category: "research",
    correlationId: randomUUID(),
    researchStage: "leads",
  };

  const result = await generateStructuredJson<{ message: string }>({
    task: "lead_outreach_message",
    systemInstruction:
      "You write short, specific, non-salesy LinkedIn outreach messages on behalf of a founder reaching out " +
      "to a potential customer or partner. Never write generic sales filler ('I noticed you...', 'I'd love to " +
      "connect...', 'game-changing solution'). Ground every message in the specific, concrete details provided " +
      "about this exact lead. JSON only.",
    userPrompt: `Sender's business: ${profile.businessName} (${profile.serviceDomain}), targeting ${profile.targetAudience}.

Lead: ${lead.company}
Why this lead is a good fit: ${lead.whyFit}
${lead.whyPerfect ? `Why this lead is especially strong: ${lead.whyPerfect}\n` : ""}${lead.pitchOutline ? `Pitch angle: ${lead.pitchOutline}\n` : ""}${lead.contactPlan ? `Suggested contact approach: ${lead.contactPlan}\n` : ""}Contact hints: ${lead.contactHints}
${lead.objections?.length ? `Likely objections to preempt lightly (don't over-address): ${lead.objections.join("; ")}\n` : ""}
Write a single LinkedIn connection/message note, 2-4 sentences, specific to this lead's situation, ending with a soft, low-pressure call to action (not "let's hop on a call"). No greeting boilerplate like "Hi there" — assume it opens by name at send time (do not include a name placeholder).

Return JSON: { "message": string }`,
    parse: (raw) => {
      const obj = raw as { message?: unknown };
      if (typeof obj.message !== "string" || !obj.message.trim()) {
        throw new Error("AI response missing 'message' string");
      }
      return { message: obj.message.trim() };
    },
    trace,
  });

  return result.data.message;
}
