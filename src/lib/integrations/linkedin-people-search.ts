import { runApifyActor } from "@/lib/integrations/apify";

const ACTOR_ID = "harvestapi~linkedin-profile-search";

const DECISION_MAKER_TITLES = [
  "Founder",
  "Co-Founder",
  "CEO",
  "Chief Executive Officer",
  "Owner",
  "Managing Director",
  "President",
  "VP Marketing",
  "Head of Marketing",
  "Marketing Director",
  "Head of Growth",
  "Growth Director",
];

export interface DecisionMakerContact {
  name: string;
  title: string;
  profileUrl: string;
}

interface RawLinkedInProfile {
  linkedinUrl?: string;
  publicIdentifier?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  headline?: string;
  position?: string;
  currentPosition?: { title?: string };
}

function normalize(item: RawLinkedInProfile): DecisionMakerContact | null {
  const profileUrl = item.linkedinUrl;
  if (!profileUrl) return null;

  const name =
    item.fullName ??
    [item.firstName, item.lastName].filter(Boolean).join(" ").trim();
  if (!name) return null;

  const title = item.currentPosition?.title ?? item.position ?? item.headline ?? "";

  return { name, title, profileUrl };
}

/**
 * Best-effort search for a likely decision-maker (founder/CEO/marketing/growth lead)
 * at the given company. Degrades to null if APIFY_API_TOKEN is unset or nothing found,
 * same as every other integration in this app — never blocks the outreach flow.
 */
export async function findDecisionMakerContact(
  companyName: string,
): Promise<DecisionMakerContact | null> {
  if (!companyName.trim()) return null;

  const items = await runApifyActor<RawLinkedInProfile>(ACTOR_ID, {
    searchQuery: companyName,
    companies: [companyName],
    currentJobTitles: DECISION_MAKER_TITLES,
    startPage: 1,
    takePages: 1,
  });

  const candidates = items.map(normalize).filter((p): p is DecisionMakerContact => p !== null);
  return candidates[0] ?? null;
}
