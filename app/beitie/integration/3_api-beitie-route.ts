// app/api/beitie/route.ts

import { NextRequest, NextResponse } from "next/server";
import { listBeitie } from "@/lib/db/beitie-queries";

export async function GET(request: NextRequest) {
  const style = request.nextUrl.searchParams.get("style") || undefined;
  const items = listBeitie(style);
  return NextResponse.json({ items });
}
