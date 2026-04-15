import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getJiziCoverage } from "@/lib/db/queries";

// Facet data for the 集字 picker modal: given the typed phrase (and
// optionally a style filter), return every calligrapher and every work
// with the total image count for those characters. Zero-count entries
// are included so the UI can render grayed-out chips without a second
// fetch.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get("text") || "";
  const style = searchParams.get("style") || undefined;

  if (!text) {
    return NextResponse.json({
      characters: [],
      calligraphers: [],
      works: [],
    });
  }

  // Resolve every typed character to its id. Missing characters are
  // recorded with found=false so the UI can show "not in dictionary" hints.
  const chars = [...text];
  const characterInfo = chars.map((char) => {
    const row = getCharacterByChar(char);
    return {
      char,
      id: row?.id ?? null,
      found: row != null,
    };
  });

  const knownIds = characterInfo
    .map((c) => c.id)
    .filter((id): id is number => id != null);

  const { calligraphers, works } = getJiziCoverage({
    characterIds: knownIds,
    styleSlug: style,
  });

  return NextResponse.json({
    characters: characterInfo,
    calligraphers,
    works,
  });
}