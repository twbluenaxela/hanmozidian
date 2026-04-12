import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { characters, calligraphyImages, scriptStyles } from "@/lib/db/schema";
import { eq, sql, count } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q");
  if (!q) {
    return NextResponse.json({ characters: [] });
  }

  // Split query into individual characters and search each
  const chars = [...q];

  const results = [];
  for (const char of chars) {
    const charRow = db
      .select()
      .from(characters)
      .where(eq(characters.character, char))
      .get();

    if (!charRow) continue;

    // Get image counts per style
    const styleCounts = db
      .select({
        slug: scriptStyles.slug,
        nameZh: scriptStyles.nameZh,
        count: count(),
      })
      .from(calligraphyImages)
      .innerJoin(scriptStyles, eq(calligraphyImages.styleId, scriptStyles.id))
      .where(eq(calligraphyImages.characterId, charRow.id))
      .groupBy(calligraphyImages.styleId)
      .orderBy(scriptStyles.sortOrder)
      .all();

    results.push({
      character: charRow.character,
      unicodeHex: charRow.unicodeHex,
      styleCounts,
      totalImages: styleCounts.reduce((sum, s) => sum + s.count, 0),
    });
  }

  return NextResponse.json({ characters: results });
}
