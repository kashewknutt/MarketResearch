import { buildProjections } from "@/lib/research/projection-engine";
import { migrateAssumptionsToLineItems } from "@/lib/research/expense-line-items";
import type { FinancialSnapshot, OnboardingProfile } from "@/lib/types/domain";

/** Ensure stored snapshots have expense line items and fresh projections. */
export function normalizeFinancialSnapshot(
  snapshot: FinancialSnapshot,
  profile: OnboardingProfile,
): FinancialSnapshot {
  const defaults = migrateAssumptionsToLineItems({}, profile, snapshot.assumptions.value);
  const migrated = migrateAssumptionsToLineItems(
    snapshot.assumptions.value,
    profile,
    defaults,
  );
  const rebuilt = buildProjections(
    profile,
    migrated,
    snapshot.narrative,
    snapshot.leverageVariables,
    snapshot.monthlyPlans,
  );
  return {
    ...rebuilt,
    linkedInAdHistory: snapshot.linkedInAdHistory ?? rebuilt.linkedInAdHistory,
    monthlyPlans: rebuilt.monthlyPlans,
    assumptions: {
      ...snapshot.assumptions,
      value: migrated,
    },
    provenance: snapshot.provenance ?? rebuilt.provenance,
  };
}
