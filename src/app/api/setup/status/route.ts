import { NextResponse } from "next/server";
import { isSetupComplete, getSetupVerification } from "@/lib/store/setup";

export async function GET() {
  const complete = await isSetupComplete();
  const record = await getSetupVerification();
  return NextResponse.json({
    complete,
    passedAt: record?.passedAt ?? null,
    lastReport: record?.report ?? null,
  });
}
