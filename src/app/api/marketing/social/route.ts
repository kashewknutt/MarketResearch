import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/store/snapshots";
import type { MarketingSocialSnapshot } from "@/lib/types/domain";

export async function GET() {
  const social = await getSnapshot<MarketingSocialSnapshot>("marketing_social");
  return NextResponse.json({ social });
}
