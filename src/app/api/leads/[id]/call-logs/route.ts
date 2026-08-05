import { NextRequest, NextResponse } from "next/server";
import { addCallLog, getCallLogsForLead } from "@/lib/store/lead-call-logs";
import type { CallOutcome } from "@/lib/types/domain";

const VALID_OUTCOMES: CallOutcome[] = [
  "no_answer",
  "voicemail",
  "not_interested",
  "interested",
  "callback_later",
  "wrong_number",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const logs = await getCallLogsForLead(id);
  return NextResponse.json({ logs });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const outcome = body.outcome as CallOutcome;
  if (!VALID_OUTCOMES.includes(outcome)) {
    return NextResponse.json({ error: "A valid outcome is required" }, { status: 400 });
  }

  const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : undefined;

  await addCallLog(id, outcome, notes);
  const logs = await getCallLogsForLead(id);
  return NextResponse.json({ logs }, { status: 201 });
}
