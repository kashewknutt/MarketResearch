import { NextRequest, NextResponse } from "next/server";
import { getLeadById } from "@/lib/store/leads";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const lead = await getLeadById(id);
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ lead });
}
