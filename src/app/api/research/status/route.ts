import { NextRequest, NextResponse } from "next/server";
import { getLatestResearchJob, getResearchJob } from "@/lib/store/research-jobs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  const job = id ? await getResearchJob(id) : await getLatestResearchJob();
  return NextResponse.json({ job });
}
