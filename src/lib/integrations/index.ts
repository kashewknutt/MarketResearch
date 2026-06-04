export { redditStatus, fetchRedditSignals } from "./reddit";
export {
  linkedinStatus,
  linkedinFromSocialUrl,
  linkedInCompanyUrlFromProfile,
} from "./linkedin";
export type { IntegrationStatus, IntegrationSignal } from "./types";

import { linkedinStatus } from "./linkedin";
import { redditStatus } from "./reddit";

export function allIntegrationStatuses() {
  return [redditStatus(), linkedinStatus()];
}
