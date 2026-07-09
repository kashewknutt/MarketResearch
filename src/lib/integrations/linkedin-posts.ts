import { linkedInRestHeaders } from "./linkedin-api";
import { linkedInAuthorizedFetch } from "./linkedin-oauth";

const POSTS_URL = "https://api.linkedin.com/rest/posts";

export function linkedInPersonUrnConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_PERSON_URN?.trim());
}

/** Creates a text/caption post on LinkedIn as the configured member. No media upload support. */
export async function createLinkedInTextPost(commentary: string): Promise<{ postUrn: string }> {
  const personUrn = process.env.LINKEDIN_PERSON_URN?.trim();
  if (!personUrn) {
    throw new Error("LINKEDIN_PERSON_URN is not configured — see README LinkedIn publishing section.");
  }

  const body = {
    author: personUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const res = await linkedInAuthorizedFetch(POSTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...linkedInRestHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (res.status !== 201) {
    const text = await res.text().catch(() => "");
    throw new Error(`LinkedIn post failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const postUrn = res.headers.get("x-restli-id");
  if (!postUrn) {
    throw new Error("LinkedIn post created but no x-restli-id header returned.");
  }
  return { postUrn };
}
