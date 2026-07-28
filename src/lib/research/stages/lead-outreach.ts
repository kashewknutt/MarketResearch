import { randomUUID } from "crypto";
import { generateStructuredJson } from "@/lib/ai/gemini";
import { outreachMessageDraftSchema, safeParse } from "@/lib/agents/validate";
import type { AiCallTrace } from "@/lib/ai/pricing-types";
import type { LeadRecord, OnboardingProfile, OutreachMessageDraft } from "@/lib/types/domain";

/**
 * Drafts a short, specific, non-salesy LinkedIn outreach message for a single lead, grounded in
 * whatever context was already generated for it during lead discovery — never generic filler.
 */
export async function draftOutreachMessage(
  profile: OnboardingProfile,
  lead: LeadRecord,
  context?: string,
): Promise<OutreachMessageDraft> {
  const trace: AiCallTrace = {
    operation: "research.lead_outreach_message",
    category: "research",
    correlationId: randomUUID(),
    researchStage: "leads",
  };

  const result = await generateStructuredJson<OutreachMessageDraft>({
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
${lead.objections?.length ? `Likely objections to preempt lightly (don't over-address): ${lead.objections.join("; ")}\n` : ""}${context ? `Additional context about this lead/contact: ${context}\n` : ""}
Write a LinkedIn InMail-style message with three parts:
- "subject": a short, specific subject line (not generic, no clickbait).
- "hookLine": a single attention-grabbing opening sentence distinct from the greeting, specific to this lead's situation.
- "body": the full message (2-4 sentences), starting with an opening salutation (assume it opens by first name at send time — do not include a name placeholder, just start naturally e.g. "Hi," is fine to omit if body flows from the hook) and ending with a short, low-pressure closing sign-off (not "let's hop on a call"). No greeting boilerplate like "Hi there".

Return JSON: { "subject": string, "hookLine": string, "body": string }`,
    parse: (raw) => {
      const parsed = safeParse(outreachMessageDraftSchema, raw);
      if (!parsed) throw new Error("AI response missing subject/hookLine/body");
      return parsed;
    },
    trace,
  });

  return result.data;
}
