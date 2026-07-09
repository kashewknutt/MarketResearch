import fs from "fs";
import path from "path";
import {
  classifyGeminiError,
  GEMINI_SETUP_MESSAGE,
  isGeminiApiError,
} from "@/lib/ai/gemini-errors";
import { GEMINI_MODEL } from "@/lib/ai/constants";
import {
  hasGeminiKey,
  verifyGeminiConnection,
  verifyGoogleSearchGrounding,
} from "@/lib/ai/gemini";
import { getDataDir } from "@/lib/db/paths";
import {
  linkedinEnvPresence,
  linkedInPublishEnvPresence,
  redditEnvPresence,
  verifyLinkedInConnection,
  verifyLinkedInPublishConnection,
  verifyRedditConnection,
  verifyYoutubeConnection,
  youtubePresence,
} from "@/lib/setup/integration-checks";
import type {
  RequirementCheckResult,
  RequirementId,
  SetupRequirementsReport,
} from "@/lib/setup/types";
import { REQUIRED_REQUIREMENT_IDS } from "@/lib/setup/types";

const LINKS = {
  apiKey: "https://aistudio.google.com/apikey",
  aiStudio: "https://aistudio.google.com/",
  googleSearchDocs:
    "https://ai.google.dev/gemini-api/docs/google-search",
  gcpBilling: "https://console.cloud.google.com/billing",
  gcpApis: "https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com",
  gcpEnabledApis: "https://console.cloud.google.com/apis/dashboard",
};

function check(
  id: RequirementId,
  label: string,
  description: string,
  passed: boolean,
  message: string,
  options?: { detail?: string; actionLabel?: string; actionUrl?: string },
): RequirementCheckResult {
  return {
    id,
    label,
    description,
    state: passed ? "passed" : "failed",
    message,
    ...options,
  };
}

function checkSkipped(
  id: RequirementId,
  label: string,
  description: string,
  message: string,
  options?: { detail?: string; actionLabel?: string; actionUrl?: string },
): RequirementCheckResult {
  return {
    id,
    label,
    description,
    state: "skipped",
    message,
    ...options,
  };
}

function checkEnvApiKey(): RequirementCheckResult {
  const present = hasGeminiKey();
  return check(
    "env_api_key",
    "Gemini API key configured",
    "GEMINI_API_KEY must be set in .env.local (server-side only).",
    present,
    present
      ? "API key found in environment."
      : GEMINI_SETUP_MESSAGE,
    {
      actionLabel: "Get API key",
      actionUrl: LINKS.apiKey,
    },
  );
}

async function checkGeminiApi(): Promise<RequirementCheckResult> {
  if (!hasGeminiKey()) {
    return check(
      "gemini_api",
      "Gemini API reachable",
      "Verifies your key can call the Gemini API.",
      false,
      "Skipped until API key is configured.",
      { actionLabel: "Configure API key", actionUrl: LINKS.apiKey },
    );
  }

  const result = await verifyGeminiConnection();
  const passed = result.status === "ready";
  return check(
    "gemini_api",
    "Gemini API reachable",
    "Verifies your key can call the Gemini API.",
    passed,
    result.message,
    passed
      ? undefined
      : {
          actionLabel: "Open Google AI Studio",
          actionUrl: LINKS.aiStudio,
          detail: `Model: ${result.model}`,
        },
  );
}

async function checkModelAccess(): Promise<RequirementCheckResult> {
  if (!hasGeminiKey()) {
    return check(
      "model_access",
      `Model access (${GEMINI_MODEL})`,
      "Confirms the configured Gemini model is available for your project.",
      false,
      "Skipped until API key is configured.",
      { actionLabel: "Get API key", actionUrl: LINKS.apiKey },
    );
  }

  try {
    const result = await verifyGeminiConnection();
    const passed = result.status === "ready";
    return check(
      "model_access",
      `Model access (${GEMINI_MODEL})`,
      "Confirms the configured Gemini model is available for your project.",
      passed,
      passed
        ? `${GEMINI_MODEL} responded successfully.`
        : result.message,
      passed
        ? undefined
        : {
            actionLabel: "Review model access",
            actionUrl: LINKS.aiStudio,
          },
    );
  } catch (err) {
    const msg = isGeminiApiError(err)
      ? err.userMessage
      : classifyGeminiError(err).userMessage;
    return check(
      "model_access",
      `Model access (${GEMINI_MODEL})`,
      "Confirms the configured Gemini model is available for your project.",
      false,
      msg,
      { actionLabel: "Google AI Studio", actionUrl: LINKS.aiStudio },
    );
  }
}

async function checkGoogleSearch(): Promise<RequirementCheckResult> {
  const groundingNote =
    "Uses Gemini grounding (google_search tool) — not Custom Search API or Search Console (those need OAuth/service accounts and are not used here).";

  if (!hasGeminiKey()) {
    return check(
      "google_search",
      "Gemini Google Search grounding",
      groundingNote,
      false,
      "Skipped until GEMINI_API_KEY is configured.",
      {
        actionLabel: "Grounding documentation",
        actionUrl: LINKS.googleSearchDocs,
      },
    );
  }

  const result = await verifyGoogleSearchGrounding();
  return check(
    "google_search",
    "Gemini Google Search grounding",
    groundingNote,
    result.ok,
    result.ok
      ? `${result.message} No OAuth or Custom Search credentials needed.`
      : result.message,
    result.ok
      ? { detail: `${result.citationsCount} source(s) returned.` }
      : {
          actionLabel: "Grounding with Google Search (Gemini)",
          actionUrl: LINKS.googleSearchDocs,
        },
  );
}

async function checkBillingQuota(): Promise<RequirementCheckResult> {
  if (!hasGeminiKey()) {
    return check(
      "billing_quota",
      "Billing & quota",
      "Google Search grounding on Gemini 3 requires an active billing account (usage-based).",
      false,
      "Skipped until API key is configured.",
      { actionLabel: "Cloud billing", actionUrl: LINKS.gcpBilling },
    );
  }

  const search = await verifyGoogleSearchGrounding();
  const api = await verifyGeminiConnection();

  const billingSignals = [search.message, api.message].join(" ").toLowerCase();
  const billingIssue =
    billingSignals.includes("billing must be") ||
    billingSignals.includes("billing account") ||
    billingSignals.includes("billing not enabled") ||
    api.status === "billing_required";

  const creditsIssue =
    billingSignals.includes("prepaid") ||
    billingSignals.includes("prepayment") ||
    billingSignals.includes("credit") ||
    api.status === "credits_depleted" ||
    api.status === "rate_limited";

  if (api.status === "ready" && search.ok) {
    return check(
      "billing_quota",
      "Billing & quota",
      "Google Search grounding on Gemini 3 requires an active billing account (usage-based).",
      true,
      "API calls succeeded — billing/quota appears sufficient for research.",
      {
        actionLabel: "Cloud billing console",
        actionUrl: LINKS.gcpBilling,
      },
    );
  }

  if (creditsIssue) {
    return check(
      "billing_quota",
      "Billing & quota",
      "Google Search grounding on Gemini 3 requires an active billing account (usage-based).",
      false,
      api.message || search.message,
      {
        actionLabel: "Manage credits in AI Studio",
        actionUrl: LINKS.aiStudio,
        detail: search.ok ? api.message : search.message,
      },
    );
  }

  if (billingIssue) {
    return check(
      "billing_quota",
      "Billing & quota",
      "Google Search grounding on Gemini 3 requires an active billing account (usage-based).",
      false,
      "Billing may not be enabled on the Google Cloud project linked to your Gemini API key. Enable the Generative Language API and paid-tier grounding — you do not need Custom Search or Search Console OAuth.",
      {
        actionLabel: "Enable billing in GCP",
        actionUrl: LINKS.gcpBilling,
        detail: search.ok ? api.message : search.message,
      },
    );
  }

  return check(
    "billing_quota",
    "Billing & quota",
    "Google Search grounding on Gemini 3 requires an active billing account (usage-based).",
    false,
    "Could not confirm billing/quota. Resolve Gemini API and Google Search checks first, then enable billing in Google Cloud Console.",
    {
      actionLabel: "GCP APIs dashboard",
      actionUrl: LINKS.gcpEnabledApis,
      detail: api.message,
    },
  );
}

function checkLocalStorage(): RequirementCheckResult {
  try {
    const dir = getDataDir();
    const probe = path.join(dir, ".write-test");
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return check(
      "local_storage",
      "Local data storage",
      "SQLite database and cache are stored on this device.",
      true,
      `Writable data directory: ${dir}`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Storage check failed";
    return check(
      "local_storage",
      "Local data storage",
      "SQLite database and cache are stored on this device.",
      false,
      `Cannot write to data folder: ${message}`,
    );
  }
}

async function checkRedditOptional(): Promise<RequirementCheckResult> {
  const presence = redditEnvPresence();
  const readme = "README — Reddit API";

  if (presence === "none") {
    return checkSkipped(
      "reddit_optional",
      "Reddit API (optional)",
      "Enriches research with Reddit post signals.",
      "Skipped — no Reddit variables in .env. Add Reddit script app credentials (see README) for richer research.",
      { actionLabel: readme, actionUrl: "https://www.reddit.com/prefs/apps" },
    );
  }

  if (presence === "partial") {
    return check(
      "reddit_optional",
      "Reddit API (optional)",
      "Enriches research with Reddit post signals.",
      false,
      "Incomplete Reddit config — script apps need REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USER_AGENT, REDDIT_USERNAME, and REDDIT_PASSWORD.",
      { actionLabel: readme, actionUrl: "https://www.reddit.com/prefs/apps" },
    );
  }

  const result = await verifyRedditConnection();
  return check(
    "reddit_optional",
    "Reddit API (optional)",
    "Enriches research with Reddit post signals.",
    result.ok,
    result.message,
    result.ok
      ? { detail: result.detail }
      : { actionLabel: readme, actionUrl: "https://www.reddit.com/prefs/apps", detail: result.detail },
  );
}

async function checkLinkedInOptional(): Promise<RequirementCheckResult> {
  const presence = linkedinEnvPresence();

  if (presence === "none") {
    return checkSkipped(
      "linkedin_optional",
      "LinkedIn Advertising API (optional)",
      "Imports real LinkedIn ad spend into Financial Analysis when configured.",
      "Skipped — no LinkedIn variables in .env. Add Advertising API tokens (see README) for ad spend and stronger signals.",
      {
        actionLabel: "README — LinkedIn",
        actionUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/getting-started",
      },
    );
  }

  if (presence === "partial") {
    return check(
      "linkedin_optional",
      "LinkedIn Advertising API (optional)",
      "Imports real LinkedIn ad spend into Financial Analysis when configured.",
      false,
      "Incomplete LinkedIn config — set LINKEDIN_ACCESS_TOKEN (or REFRESH_TOKEN + CLIENT_ID + CLIENT_SECRET).",
      {
        actionLabel: "README — LinkedIn",
        actionUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/getting-started",
      },
    );
  }

  const result = await verifyLinkedInConnection();
  return check(
    "linkedin_optional",
    "LinkedIn Advertising API (optional)",
    "Imports real LinkedIn ad spend into Financial Analysis when configured.",
    result.ok,
    result.message,
    result.ok
      ? { detail: result.detail }
      : {
          actionLabel: "README — LinkedIn",
          actionUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/getting-started",
          detail: result.detail,
        },
  );
}

async function checkYoutubeOptional(): Promise<RequirementCheckResult> {
  const presence = youtubePresence();
  const docsUrl = "https://console.cloud.google.com/apis/library/youtube.googleapis.com";

  if (presence === "none") {
    return checkSkipped(
      "youtube_optional",
      "YouTube Data API (optional)",
      "Fetches real trending videos for Ads & Content research.",
      "Skipped — no YOUTUBE_API_KEY in .env. Add one (see README) for real YouTube trend data; Ads & Content still works via Gemini search alone.",
      { actionLabel: "Enable YouTube Data API v3", actionUrl: docsUrl },
    );
  }

  const result = await verifyYoutubeConnection();
  return check(
    "youtube_optional",
    "YouTube Data API (optional)",
    "Fetches real trending videos for Ads & Content research.",
    result.ok,
    result.message,
    result.ok
      ? { detail: result.detail }
      : { actionLabel: "Enable YouTube Data API v3", actionUrl: docsUrl, detail: result.detail },
  );
}

async function checkLinkedInPublishOptional(): Promise<RequirementCheckResult> {
  const presence = linkedInPublishEnvPresence();
  const readme = "README — LinkedIn publishing";
  const docsUrl = "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api";

  if (presence === "none") {
    return checkSkipped(
      "linkedin_publish_optional",
      "LinkedIn publishing (optional)",
      "Publishes generated ad ideas directly to LinkedIn from Ads & Content.",
      "Skipped — no LINKEDIN_PERSON_URN in .env. Request the 'Share on LinkedIn' product and add your person URN (see README) to publish in-app.",
      { actionLabel: readme, actionUrl: docsUrl },
    );
  }

  const result = await verifyLinkedInPublishConnection();
  return check(
    "linkedin_publish_optional",
    "LinkedIn publishing (optional)",
    "Publishes generated ad ideas directly to LinkedIn from Ads & Content.",
    result.ok,
    result.message,
    result.ok
      ? { detail: result.detail }
      : { actionLabel: readme, actionUrl: docsUrl, detail: result.detail },
  );
}

export async function runSetupRequirementsCheck(): Promise<SetupRequirementsReport> {
  const checks: RequirementCheckResult[] = [];

  checks.push(checkEnvApiKey());

  const apiCheck = await checkGeminiApi();
  checks.push(apiCheck);

  checks.push(await checkModelAccess());
  checks.push(await checkGoogleSearch());
  checks.push(await checkBillingQuota());
  checks.push(checkLocalStorage());

  checks.push(await checkRedditOptional());
  checks.push(await checkLinkedInOptional());
  checks.push(await checkYoutubeOptional());
  checks.push(await checkLinkedInPublishOptional());

  const requiredChecks = checks.filter((c) =>
    REQUIRED_REQUIREMENT_IDS.includes(c.id),
  );
  const requiredPassed = requiredChecks.filter((c) => c.state === "passed").length;
  const allPassed = requiredChecks.every((c) => c.state === "passed");

  return {
    allPassed,
    checkedAt: new Date().toISOString(),
    checks,
    requiredPassed,
    requiredTotal: requiredChecks.length,
  };
}

export { LINKS as SETUP_LINKS };
