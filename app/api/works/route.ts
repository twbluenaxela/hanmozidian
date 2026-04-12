import { NextRequest, NextResponse } from "next/server";
import { getWorksForFilter } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const calligrapherId = searchParams.get("calligrapher")
    ? parseInt(searchParams.get("calligrapher")!)
    : undefined;
  const style = searchParams.get("style") || undefined;

  const works = getWorksForFilter({ calligrapherId, styleSlug: style });
  return NextResponse.json({ works });
}
