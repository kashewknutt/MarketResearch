import { buildProjections, defaultAssumptions } from "../projection-engine";
import { computeBothScenarios } from "../financial-timeline-engine";
import type { OnboardingProfile } from "@/lib/types/domain";

function run(profile: OnboardingProfile) {
  return buildProjections(profile, defaultAssumptions(profile));
}

const usProfile: OnboardingProfile = {
  businessName: "Test Co",
  website: "https://test.com",
  serviceDomain: "Consulting",
  targetAudience: "SMBs",
  regions: ["US", "India"],
  socialLinks: [],
  currency: "USD",
  currentMrr: 10000,
  targetMrr: 50000,
  goalMonths: 12,
  strategicGoals: "Grow",
  constraints: "",
  completedAt: new Date().toISOString(),
};

const inrProfile: OnboardingProfile = {
  ...usProfile,
  currency: "INR",
  currentMrr: 2000,
  targetMrr: 10000,
  goalMonths: 40,
};

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

const snap = run(usProfile);
assert(snap.projections.length === 12, `Expected 12 months, got ${snap.projections.length}`);
assert(snap.monthlyPlans != null, "monthlyPlans should exist");
assert(
  snap.monthlyPlans!.expenses.length === 12,
  `expense table length ${snap.monthlyPlans!.expenses.length}`,
);
assert(
  snap.monthlyPlans!.conservative.length === 12,
  "conservative income table length",
);
assert(
  snap.monthlyPlans!.ambitious.length === 12,
  "ambitious income table length",
);

const { conservative, ambitious } = computeBothScenarios(
  usProfile,
  snap.assumptions.value,
  snap.monthlyPlans!,
);
assert(
  ambitious.finalMrr > conservative.finalMrr,
  `ambitious ${ambitious.finalMrr} should exceed conservative ${conservative.finalMrr}`,
);
assert(
  ambitious.finalMrr >= usProfile.targetMrr * 0.7,
  `ambitious end MRR ${ambitious.finalMrr} below 70% of target`,
);
assert(
  ambitious.finalMrr <= usProfile.targetMrr * 1.15,
  `ambitious end MRR ${ambitious.finalMrr} too high`,
);

const highMonths = snap.monthlyPlans!.ambitious.filter((r) => r.highTicketCash > 0);
assert(highMonths.length >= 2, "should have high-ticket months in ambitious plan");

const lowMrrMonths = snap.projections.filter((p) => (p.cashCollected ?? 0) > 0);
assert(lowMrrMonths.length >= 8, "most months should have cash in");

assert(
  snap.scenarios.conservative.length === 12 &&
    snap.scenarios.aggressive.length === 12,
  "scenario series length",
);
assert(
  snap.scenarios.aggressive[snap.scenarios.aggressive.length - 1]! >
    snap.scenarios.conservative[snap.scenarios.conservative.length - 1]!,
  "aggressive series should end above conservative",
);

const inrSnap = run(inrProfile);
assert(inrSnap.projections.length === 40, "INR 40-month horizon");
const inrEnd =
  inrSnap.projections[inrSnap.projections.length - 1]!.recurringMrr ??
  inrSnap.projections[inrSnap.projections.length - 1]!.revenue;
assert(inrEnd > inrProfile.currentMrr, `INR should grow: ${inrEnd}`);
assert(inrEnd >= inrProfile.targetMrr * 0.5, `INR end ${inrEnd} too low`);

if (failed === 0) {
  console.log("projection-engine.test.ts: OK");
} else {
  process.exit(1);
}
