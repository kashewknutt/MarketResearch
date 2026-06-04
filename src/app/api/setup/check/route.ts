import { NextResponse } from "next/server";
import { runSetupRequirementsCheck } from "@/lib/setup/requirements";
import {
  getSetupVerification,
  isSetupComplete,
  saveSetupVerification,
} from "@/lib/store/setup";

export async function GET() {
  const report = await runSetupRequirementsCheck();
  const previouslyVerified = await isSetupComplete();

  return NextResponse.json({
    report,
    previouslyVerified,
    lastVerifiedAt: (await getSetupVerification())?.passedAt ?? null,
  });
}

export async function POST() {
  const report = await runSetupRequirementsCheck();

  if (!report.allPassed) {
    return NextResponse.json(
      {
        error: "requirements_incomplete",
        message:
          "Not all requirements passed. Fix the pending items below and run checks again.",
        report,
      },
      { status: 400 },
    );
  }

  await saveSetupVerification(report);

  return NextResponse.json({
    ok: true,
    report,
    redirectTo: "/onboarding",
  });
}
