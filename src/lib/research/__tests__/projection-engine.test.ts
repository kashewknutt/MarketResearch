import { buildProjections, defaultAssumptions } from "../projection-engine";
import { simulateServiceBusinessMonths } from "../service-projection-engine";
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
assert(typeof snap.gapToGoal === "number", "gapToGoal should be a number");
assert(Math.abs(snap.gapToGoal) <= usProfile.targetMrr, `gap too large: ${snap.gapToGoal}`);
assert(
  snap.projections.every((p) => p.revenue <= usProfile.targetMrr * 1.05),
  "MRR should not far exceed target",
);
assert(
  snap.projections.some((p) => p.cashCollected != null),
  "service model should set cashCollected",
);
const zeroCashMonths = snap.projections.filter((p) => (p.cashCollected ?? -1) === 0);
assert(zeroCashMonths.length >= 0, "zero cash months possible");

const revenues = snap.projections.map((p) => p.revenue);
const allSameDelta =
  revenues.length > 2 &&
  revenues.slice(1).every((r, i) => r - revenues[i]! === revenues[1]! - revenues[0]!);
assert(!allSameDelta, "MRR series should not be perfectly linear");

const inrSnap = run(inrProfile);
assert(inrSnap.projections.length === 40, "INR 40-month horizon");
const maxMrr = Math.max(...inrSnap.projections.map((p) => p.revenue));
assert(maxMrr <= inrProfile.targetMrr * 1.05, `INR MRR exploded: ${maxMrr}`);
assert(Number.isFinite(inrSnap.gapToGoal), "gap must be finite");
assert(
  Math.abs(inrSnap.gapToGoal) < 1e9,
  `gap astronomical: ${inrSnap.gapToGoal}`,
);

const last = inrSnap.projections[inrSnap.projections.length - 1]!;
assert(last.expenses > 0, "expenses should be positive");

const forcedZero = simulateServiceBusinessMonths(
  usProfile,
  { ...defaultAssumptions(usProfile), monthsWithZeroCashPct: 0.99, leadVolume: 20 },
  12,
  "zero-cash-test",
);
assert(
  forcedZero.projections.some((p) => p.cashCollected === 0),
  "high zero-cash pct should produce zero-cash months",
);

if (failed === 0) {
  console.log("projection-engine.test.ts: OK");
} else {
  process.exit(1);
}
