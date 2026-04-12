import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getCalligraphersForCharacter } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const char = searchParams.get("character");
  const style = searchParams.get("style") || undefined;

  if (!char) {
    return NextResponse.json({ calligraphers: [] });
  }

  const charRow = getCharacterByChar(char);
  if (!charRow) {
    return NextResponse.json({ calligraphers: [] });
  }

  const calligraphers = getCalligraphersForCharacter(charRow.id, style);
  return NextResponse.json({ calligraphers });
}
