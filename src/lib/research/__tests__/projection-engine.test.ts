import { buildProjections, defaultAssumptions } from "../projection-engine";
import type { OnboardingProfile } from "@/lib/types/domain";

const profile: OnboardingProfile = {
  businessName: "Test Co",
  website: "https://test.com",
  serviceDomain: "Consulting",
  targetAudience: "SMBs",
  regions: ["US", "India"],
  currentMrr: 10000,
  goalRevenue: 50000,
  goalMonths: 12,
  strategicGoals: "Grow",
  constraints: "",
  completedAt: new Date().toISOString(),
};

const snapshot = buildProjections(profile, defaultAssumptions(profile));

if (snapshot.projections.length !== 12) {
  throw new Error(`Expected 12 months, got ${snapshot.projections.length}`);
}
if (typeof snapshot.gapToGoal !== "number") {
  throw new Error("gapToGoal should be a number");
}

console.log("projection-engine.test.ts: OK");
