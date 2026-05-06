import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getStyleCounts } from "@/lib/db/queries";
import { simplifiedToTraditional } from "@/lib/s2t";

// GET /api/search?q= — resolves each character in the query string to its
// dictionary entry with per-style image counts. Missing characters are silently skipped.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const q = simplifiedToTraditional(request.nextUrl.searchParams.get("q") ?? "").trim() || null;
  if (!q) {
    return NextResponse.json({ characters: [] });
  }

  const results = [];
  for (const char of [...q]) {
    const charRow = getCharacterByChar(char);
    if (!charRow) continue;

    const styleCounts = getStyleCounts(charRow.id);
    results.push({
      character: charRow.character,
      unicodeHex: charRow.unicodeHex,
      styleCounts,
      totalImages: styleCounts.reduce((sum, s) => sum + s.count, 0),
    });
  }

  return NextResponse.json({ characters: results });
}
