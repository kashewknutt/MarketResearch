export { redditStatus, fetchRedditSignals } from "./reddit";
export {
  linkedinStatus,
  linkedinFromSocialUrl,
  linkedInCompanyUrlFromProfile,
} from "./linkedin";
export { googlePlacesStatus, searchGooglePlacesWithoutWebsite } from "./google-places";
export { perplexityStatus, enrichColdCallLead } from "./perplexity";
export type { IntegrationStatus, IntegrationSignal } from "./types";

import { linkedinStatus } from "./linkedin";
import { redditStatus } from "./reddit";
import { googlePlacesStatus } from "./google-places";
import { perplexityStatus } from "./perplexity";

export function allIntegrationStatuses() {
  return [redditStatus(), linkedinStatus(), googlePlacesStatus(), perplexityStatus()];
}
