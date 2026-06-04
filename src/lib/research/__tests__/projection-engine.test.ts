import { buildProjections, defaultAssumptions } from "../projection-engine";
import {
  computePlMonth,
  computePlBothScenarios,
} from "../financial-pl-engine";
import type { OnboardingProfile } from "@/lib/types/domain";

function run(profile: OnboardingProfile) {
  return buildProjections(profile, defaultAssumptions(profile));
}

const usProfile: OnboardingProfile = {
  businessName: "Test Co",
  website: "https://test.com",
  serviceDomain: "Software development agency",
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

let failed = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    failed++;
  }
}

const snap = run(usProfile);
assert(snap.metricWorkbook != null, "metricWorkbook should exist");
const wb = snap.metricWorkbook!;
assert(wb.metrics.length >= 5, `metrics count ${wb.metrics.length}`);
assert(
  wb.metrics.some((m) => m.kind === "revenue"),
  "has revenue metrics",
);
assert(
  wb.metrics.some((m) => m.kind === "expense"),
  "has expense metrics",
);

const revenueMetrics = wb.metrics.filter((m) => m.kind === "revenue");
const month0 = computePlMonth(wb.metrics, wb.ambitious, 0);
let sumRev = 0;
for (const m of revenueMetrics) {
  sumRev += wb.ambitious[m.id]?.[0] ?? 0;
}
assert(month0.totalRevenue === sumRev, `total revenue M1 ${month0.totalRevenue} vs ${sumRev}`);

const { conservative, ambitious } = computePlBothScenarios(usProfile, wb);
assert(
  ambitious.finalMrr > conservative.finalMrr,
  `ambitious MRR ${ambitious.finalMrr} > conservative ${conservative.finalMrr}`,
);

const ambHighMonth = ambitious.summaries.some(
  (s) => (s.totalRevenue ?? 0) > (conservative.summaries.find((c) => c.month === s.month)?.totalRevenue ?? 0),
);
assert(ambHighMonth, "ambitious should exceed conservative in some month");

const hasWhaleMonth = ambitious.summaries.some((s) => {
  const enterprise = wb.metrics.find((m) => /enterprise|huge/i.test(m.label));
  if (!enterprise) return s.totalRevenue > 50000;
  const idx = s.month - 1;
  return (wb.ambitious[enterprise.id]?.[idx] ?? 0) > 0;
});
assert(hasWhaleMonth, "ambitious should have lumpy revenue month");

const m1 = ambitious.summaries[0]!;
if (m1.totalRevenue > 0) {
  const expectedMargin = m1.netProfit / m1.totalRevenue;
  assert(
    Math.abs(m1.profitMarginPct - expectedMargin) < 0.0001,
    "profit margin pct",
  );
}

assert(snap.projections.length === 12, "12 month projections");
assert(
  snap.projections[0]?.totalRevenue != null,
  "projection has totalRevenue",
);

if (failed === 0) {
  console.log("projection-engine.test.ts: OK");
} else {
  process.exit(1);
}
