import type { IntegrationStatus } from "./types";

export type GooglePlacesErrorCode =
  | "missing_key"
  | "invalid_key"
  | "permission_denied"
  | "quota_exceeded"
  | "unavailable";

export class GooglePlacesApiError extends Error {
  readonly code: GooglePlacesErrorCode;
  readonly userMessage: string;

  constructor(code: GooglePlacesErrorCode, userMessage: string, detail?: string) {
    super(detail ?? userMessage);
    this.name = "GooglePlacesApiError";
    this.code = code;
    this.userMessage = userMessage;
  }
}

export const GOOGLE_PLACES_SETUP_MESSAGE =
  "Add GOOGLE_PLACES_API_KEY to .env.local (enable the Places API in Google Cloud Console), then restart the dev server or desktop app.";

function classifyGooglePlacesError(status: string | undefined, message: string): GooglePlacesApiError {
  const lower = `${status ?? ""} ${message}`.toLowerCase();

  if (lower.includes("api_key_invalid") || lower.includes("invalid api key")) {
    return new GooglePlacesApiError(
      "invalid_key",
      "Your Google Places API key is invalid. Update GOOGLE_PLACES_API_KEY in .env.local and restart.",
      message,
    );
  }

  if (
    lower.includes("permission_denied") ||
    lower.includes("api not enabled") ||
    lower.includes("has not been used")
  ) {
    return new GooglePlacesApiError(
      "permission_denied",
      "Google rejected the request — make sure the Places API (New) is enabled for your project.",
      message,
    );
  }

  if (lower.includes("resource_exhausted") || lower.includes("quota")) {
    return new GooglePlacesApiError(
      "quota_exceeded",
      "Google Places quota reached. Wait a moment and try again, or check billing/quota in Google Cloud Console.",
      message,
    );
  }

  return new GooglePlacesApiError(
    "unavailable",
    "Could not reach Google Places. Check your network and API key, then try again.",
    message,
  );
}

export function hasGooglePlacesKey(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY?.trim());
}

export function googlePlacesStatus(): IntegrationStatus {
  const ok = hasGooglePlacesKey();
  return {
    name: "Google Places",
    configured: ok,
    message: ok ? "Google Places API key configured" : GOOGLE_PLACES_SETUP_MESSAGE,
  };
}

export interface GooglePlaceResult {
  placeId: string;
  displayName: string;
  formattedAddress?: string;
  phone: string;
  businessStatus?: string;
  googleMapsUri?: string;
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  businessStatus?: string;
  googleMapsUri?: string;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.businessStatus",
  "places.googleMapsUri",
].join(",");

/**
 * Searches Google Places (New) Text Search for businesses matching `query`, returning only
 * results that have a phone number listed but no website — real, structured data (not AI
 * search) since these numbers are meant to actually be dialed for cold calling.
 */
export async function searchGooglePlacesWithoutWebsite(
  query: string,
  maxResults: number,
): Promise<GooglePlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    throw new GooglePlacesApiError("missing_key", GOOGLE_PLACES_SETUP_MESSAGE);
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: Math.min(Math.max(maxResults, 1), 20),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const status = body?.error?.status as string | undefined;
    const message = (body?.error?.message as string | undefined) ?? `HTTP ${res.status}`;
    throw classifyGooglePlacesError(status, message);
  }

  const body = (await res.json()) as { places?: RawPlace[] };
  const places = body.places ?? [];

  return places
    .map((p): GooglePlaceResult | null => {
      const phone = p.internationalPhoneNumber ?? p.nationalPhoneNumber;
      const displayName = p.displayName?.text;
      if (!p.id || !displayName || !phone || p.websiteUri) return null;
      return {
        placeId: p.id,
        displayName,
        formattedAddress: p.formattedAddress,
        phone,
        businessStatus: p.businessStatus,
        googleMapsUri: p.googleMapsUri,
      };
    })
    .filter((p): p is GooglePlaceResult => p !== null)
    .slice(0, maxResults);
}
