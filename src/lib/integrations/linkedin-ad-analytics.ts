import { linkedInRestHeaders } from "./linkedin-api";
import { linkedInAuthorizedFetch } from "./linkedin-oauth";

export type LinkedInDateParts = { year: number; month: number; day: number };

/** Rest.li dateRange: (start:(year:Y,month:M,day:D),end:(...)) */
export function linkedInDateRange(
  start: LinkedInDateParts,
  end?: LinkedInDateParts,
): string {
  const s = `start:(year:${start.year},month:${start.month},day:${start.day})`;
  if (!end) return `(${s})`;
  return `(${s},end:(year:${end.year},month:${end.month},day:${end.day}))`;
}

export function linkedInListUrn(urn: string): string {
  return `List(${urn})`;
}

/** Build adAnalytics URL without double-encoding Rest.li params. */
export function buildAdAnalyticsUrl(params: {
  accountId: string;
  dateRange: string;
  pivot?: string;
  timeGranularity?: string;
  fields?: string;
}): string {
  const accountUrn = `urn:li:sponsoredAccount:${params.accountId}`;
  const parts = [
    ["q", "analytics"],
    ["pivot", params.pivot ?? "ACCOUNT"],
    ["timeGranularity", params.timeGranularity ?? "MONTHLY"],
    ["dateRange", params.dateRange],
    ["accounts", linkedInListUrn(accountUrn)],
  ];
  if (params.fields) parts.push(["fields", params.fields]);

  const query = parts
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  return `https://api.linkedin.com/rest/adAnalytics?${query}`;
}

export function buildAdStatisticsUrl(params: {
  accountId: string;
  dateRange: string;
  timeGranularity?: string;
  fields?: string;
}): string {
  const accountUrn = `urn:li:sponsoredAccount:${params.accountId}`;
  const parts = [
    ["q", "statistics"],
    ["pivots", linkedInListUrn("ACCOUNT")],
    ["timeGranularity", params.timeGranularity ?? "MONTHLY"],
    ["dateRange", params.dateRange],
    ["accounts", linkedInListUrn(accountUrn)],
  ];
  if (params.fields) parts.push(["fields", params.fields]);

  const query = parts
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");

  return `https://api.linkedin.com/rest/adStatistics?${query}`;
}

export function datePartsFromDate(d: Date): LinkedInDateParts {
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

export type AdAnalyticsRow = {
  month: string;
  amount: number;
};

type AnalyticsElement = {
  costInLocalCurrency?: string;
  spend?: { amount?: string; currencyCode?: string };
  dateRange?: {
    start?: { year?: number; month?: number; day?: number };
    end?: { year?: number; month?: number; day?: number };
  };
};

export function parseAdAnalyticsElements(
  elements: AnalyticsElement[],
): AdAnalyticsRow[] {
  return elements
    .map((el) => {
      const y = el.dateRange?.start?.year;
      const m = el.dateRange?.start?.month;
      if (!y || !m) return null;
      const amount =
        parseFloat(el.costInLocalCurrency ?? el.spend?.amount ?? "0") || 0;
      return {
        month: `${y}-${String(m).padStart(2, "0")}`,
        amount: Math.round(amount),
      };
    })
    .filter((x): x is AdAnalyticsRow => x !== null);
}

function logLinkedInApiError(label: string, status: number, body: string): void {
  const detail = body.length > 4000 ? `${body.slice(0, 4000)}…` : body;
  if (process.env.NODE_ENV === "development") {
    console.warn(`LinkedIn ${label} ${status}:`, detail);
  } else {
    console.warn(`LinkedIn ${label} ${status}:`, body.slice(0, 500));
  }
}

async function requestSpendRows(
  url: string,
): Promise<{ ok: boolean; status: number; rows: AdAnalyticsRow[]; body?: string }> {
  const res = await linkedInAuthorizedFetch(url, {
    headers: linkedInRestHeaders(),
  });

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, status: res.status, rows: [], body };
  }

  const data = (await res.json()) as { elements?: AnalyticsElement[] };
  return {
    ok: true,
    status: res.status,
    rows: parseAdAnalyticsElements(data.elements ?? []),
  };
}

export async function fetchAdAnalyticsForAccount(
  accountId: string,
  options?: { monthsBack?: number },
): Promise<{ ok: boolean; status: number; rows: AdAnalyticsRow[]; body?: string }> {
  const now = new Date();
  const start = new Date(now);
  start.setMonth(start.getMonth() - (options?.monthsBack ?? 12));
  start.setDate(1);

  const rangeWithEnd = linkedInDateRange(
    datePartsFromDate(start),
    datePartsFromDate(now),
  );
  const rangeStartOnly = linkedInDateRange(datePartsFromDate(start));

  const attempts: { label: string; url: string }[] = [
    {
      label: "adAnalytics MONTHLY",
      url: buildAdAnalyticsUrl({
        accountId,
        dateRange: rangeWithEnd,
        pivot: "ACCOUNT",
        timeGranularity: "MONTHLY",
        fields: "dateRange,pivotValues,costInLocalCurrency",
      }),
    },
    {
      label: "adAnalytics ALL",
      url: buildAdAnalyticsUrl({
        accountId,
        dateRange: rangeStartOnly,
        pivot: "ACCOUNT",
        timeGranularity: "ALL",
        fields: "dateRange,pivotValues,costInLocalCurrency",
      }),
    },
    {
      label: "adStatistics MONTHLY",
      url: buildAdStatisticsUrl({
        accountId,
        dateRange: rangeWithEnd,
        timeGranularity: "MONTHLY",
        fields: "dateRange,pivotValues,costInLocalCurrency",
      }),
    },
    {
      label: "adStatistics ALL",
      url: buildAdStatisticsUrl({
        accountId,
        dateRange: rangeStartOnly,
        timeGranularity: "ALL",
        fields: "dateRange,pivotValues,costInLocalCurrency",
      }),
    },
  ];

  let last: { ok: boolean; status: number; rows: AdAnalyticsRow[]; body?: string } = {
    ok: false,
    status: 0,
    rows: [],
  };

  for (const attempt of attempts) {
    const result = await requestSpendRows(attempt.url);
    last = result;
    if (result.ok && result.rows.length > 0) {
      return result;
    }
    if (!result.ok && result.body) {
      logLinkedInApiError(attempt.label, result.status, result.body);
      const illegal =
        result.status === 400 &&
        (result.body.includes("ILLEGAL_ARGUMENT") ||
          result.body.includes("INVALID_PARAM"));
      if (!illegal) {
        return result;
      }
    }
  }

  return last;
}

/** Lightweight check: ad account exists and token can read it. */
export async function verifyLinkedInAdAccountAccess(
  accountId: string,
): Promise<{ ok: boolean; status: number; message: string; detail?: string }> {
  const res = await linkedInAuthorizedFetch(
    `https://api.linkedin.com/rest/adAccounts/${encodeURIComponent(accountId)}`,
    { headers: linkedInRestHeaders() },
  );

  if (res.ok) {
    return {
      ok: true,
      status: res.status,
      message: "LinkedIn ad account is accessible with your token.",
    };
  }

  const body = await res.text();
  return {
    ok: false,
    status: res.status,
    message: `LinkedIn adAccounts returned ${res.status}. Check LINKEDIN_AD_ACCOUNT_ID and token scopes.`,
    detail: body.slice(0, 300),
  };
}
