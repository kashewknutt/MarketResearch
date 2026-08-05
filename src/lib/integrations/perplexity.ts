import type { Citation, OnboardingProfile } from "@/lib/types/domain";
import type { IntegrationStatus } from "./types";

export function hasPerplexityKey(): boolean {
  return Boolean(process.env.PERPLEXITY_API_KEY?.trim());
}

export function perplexityStatus(): IntegrationStatus {
  const ok = hasPerplexityKey();
  return {
    name: "Perplexity",
    configured: ok,
    message: ok
      ? "Perplexity API key configured"
      : "Set PERPLEXITY_API_KEY in .env — see README. Optional: cold-call leads work without it.",
  };
}

export interface ColdCallEnrichment {
  signals: string[];
  citations: Citation[];
}

interface PerplexityResponse {
  choices?: Array<{ message?: { content?: string } }>;
  citations?: string[];
}

/**
 * Best-effort search for a couple of real, cited recent signals about a business (news,
 * reviews, etc.) to enrich a cold-call lead. Degrades to null if PERPLEXITY_API_KEY is
 * unset or nothing useful is found — same convention as every other optional integration
 * in this app, never blocks the cold-call generation pipeline.
 */
export async function enrichColdCallLead(
  profile: OnboardingProfile,
  business: { name: string; address?: string },
): Promise<ColdCallEnrichment | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content:
              "You research small/local businesses for a B2B seller doing cold-call outreach. " +
              "Return 1-3 short, specific, real signals about the business (recent news, reviews, " +
              "notable activity) — never invent facts. If you find nothing real, return an empty list.",
          },
          {
            role: "user",
            content: `Business: ${business.name}${business.address ? ` (${business.address})` : ""}
Seller: ${profile.businessName} (${profile.serviceDomain})

List up to 3 short, real, specific signals about this business relevant to a cold-call pitch, one per line, no numbering.`,
          },
        ],
      }),
    });

    if (!res.ok) return null;

    const body = (await res.json()) as PerplexityResponse;
    const text = body.choices?.[0]?.message?.content ?? "";
    const signals = text
      .split("\n")
      .map((line) => line.replace(/^[-*\d.]+\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 3);

    if (signals.length === 0) return null;

    const citations: Citation[] = (body.citations ?? [])
      .slice(0, 3)
      .map((uri) => ({ title: "Perplexity source", uri }));

    return { signals, citations };
  } catch {
    return null;
  }
}
