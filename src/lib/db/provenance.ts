import type { Citation, DataSource, Provenance } from "@/lib/types/domain";

export function createProvenance(
  source: DataSource = "ai",
  citations: Citation[] = [],
  confidence?: number,
): Provenance {
  return {
    source,
    generatedAt: new Date().toISOString(),
    confidence,
    citations,
    isUserEdited: false,
    overrideHistory: [],
  };
}

export function markUserEdit<T>(
  editable: { value: T; provenance: Provenance },
  newValue: T,
): { value: T; provenance: Provenance } {
  return {
    value: newValue,
    provenance: {
      ...editable.provenance,
      source: "user",
      isUserEdited: true,
      overrideHistory: [
        ...editable.provenance.overrideHistory,
        { value: editable.value, at: new Date().toISOString() },
      ],
    },
  };
}
