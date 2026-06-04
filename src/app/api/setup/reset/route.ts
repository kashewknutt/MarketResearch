import { NextResponse } from "next/server";
import { clearSetupVerification } from "@/lib/store/setup";

export async function POST() {
  await clearSetupVerification();
  return NextResponse.json({ ok: true });
}
