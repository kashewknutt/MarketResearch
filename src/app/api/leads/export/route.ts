import { getAllLeads } from "@/lib/store/leads";
import type { LeadRecord, LeadSource } from "@/lib/types/domain";

const VALID_SOURCES: LeadSource[] = ["discovery", "project", "cold_call"];

function parseSource(value: string | null): LeadSource | undefined {
  return VALID_SOURCES.includes(value as LeadSource) ? (value as LeadSource) : undefined;
}

type ColumnKey =
  | "company"
  | "region"
  | "source"
  | "status"
  | "contactStatus"
  | "contactRemarks"
  | "fitScore"
  | "companyPhone"
  | "companyAddress"
  | "companyWebsite"
  | "businessStatus"
  | "googleRating"
  | "googleReviewCount"
  | "openingHours"
  | "whyFit"
  | "painPoint"
  | "pitchOutline"
  | "contactHints"
  | "contactPlan"
  | "signals"
  | "outreachStatus"
  | "createdAt";

const COLUMN_LABELS: Record<ColumnKey, string> = {
  company: "Company",
  region: "Region",
  source: "Source",
  status: "Status",
  contactStatus: "Contact status",
  contactRemarks: "Contact remarks",
  fitScore: "Fit score",
  companyPhone: "Phone",
  companyAddress: "Address",
  companyWebsite: "Website",
  businessStatus: "Business status",
  googleRating: "Google rating",
  googleReviewCount: "Google review count",
  openingHours: "Opening hours",
  whyFit: "Why fit",
  painPoint: "Pain point",
  pitchOutline: "Pitch outline",
  contactHints: "Contact hints",
  contactPlan: "Contact plan",
  signals: "Signals",
  outreachStatus: "Outreach status",
  createdAt: "Created at",
};

const VALID_COLUMNS = new Set<ColumnKey>(Object.keys(COLUMN_LABELS) as ColumnKey[]);

function cellValue(lead: LeadRecord, column: ColumnKey): string {
  switch (column) {
    case "company":
      return lead.company;
    case "region":
      return lead.region;
    case "source":
      return lead.source ?? "discovery";
    case "status":
      return lead.status;
    case "contactStatus":
      return lead.contactStatus ?? "not_contacted";
    case "contactRemarks":
      return lead.contactRemarks ?? "";
    case "fitScore":
      return String(lead.fitScore);
    case "companyPhone":
      return lead.companyPhone ?? "";
    case "companyAddress":
      return lead.companyAddress ?? "";
    case "companyWebsite":
      return lead.companyWebsite ?? "";
    case "businessStatus":
      return lead.businessStatus ?? "";
    case "googleRating":
      return lead.googleRating != null ? String(lead.googleRating) : "";
    case "googleReviewCount":
      return lead.googleReviewCount != null ? String(lead.googleReviewCount) : "";
    case "openingHours":
      return lead.openingHours ?? "";
    case "whyFit":
      return lead.whyFit ?? "";
    case "painPoint":
      return lead.painPoint ?? "";
    case "pitchOutline":
      return lead.pitchOutline ?? "";
    case "contactHints":
      return lead.contactHints ?? "";
    case "contactPlan":
      return lead.contactPlan ?? "";
    case "signals":
      return lead.signals?.join("; ") ?? "";
    case "outreachStatus":
      return lead.outreachStatus ?? "none";
    case "createdAt":
      return lead.createdAt;
    default:
      return "";
  }
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const columnsParam = searchParams.get("columns");
  const columns: ColumnKey[] = columnsParam
    ? (columnsParam.split(",").map((c) => c.trim()).filter((c) => VALID_COLUMNS.has(c as ColumnKey)) as ColumnKey[])
    : (["company", "companyPhone", "companyAddress", "region", "painPoint", "whyFit", "contactStatus", "source"] as ColumnKey[]);

  if (columns.length === 0) {
    return Response.json({ error: "At least one valid column is required" }, { status: 400 });
  }

  const source = parseSource(searchParams.get("source"));
  const limitParam = Number(searchParams.get("limit"));

  const all = await getAllLeads();
  const filtered = source ? all.filter((l) => (l.source ?? "discovery") === source) : all;
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.floor(limitParam) : filtered.length;
  const rows = filtered.slice(0, limit);

  const lines = [
    columns.map((c) => escapeCsvCell(COLUMN_LABELS[c])).join(","),
    ...rows.map((lead) => columns.map((c) => escapeCsvCell(cellValue(lead, c))).join(",")),
  ];
  const csv = lines.join("\r\n");

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-export-${date}.csv"`,
    },
  });
}
