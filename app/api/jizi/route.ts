// GET /api/jizi?text=&style=&calligrapher=&work=
// Returns per-character image arrays for the jizi canvas plus calligrapher/work
// facets so the picker knows which filters have results.
import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getImages, getJiziCoverage } from "@/lib/db/queries";
import { resolveImageUrl, parseIdList } from "@/lib/utils";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get("text") || "";
  const style = searchParams.get("style") || undefined;
  const calligrapherIds = parseIdList(searchParams.get("calligrapher"));
  const workIds = parseIdList(searchParams.get("work"));

  if (!text) {
    return NextResponse.json({ characters: [], calligraphers: [], works: [] });
  }

  const chars = [...text];
  const results = [];
  const knownIds: number[] = [];

  for (const char of chars) {
    const charRow = getCharacterByChar(char);
    if (!charRow) {
      results.push({ character: char, images: [], found: false });
      continue;
    }

    knownIds.push(charRow.id);

    const images = getImages({
      characterIds: [charRow.id],
      styleSlug: style,
      calligrapherIds,
      workIds,
      limit: 100,
      random: false,
    });

    results.push({
      id: charRow.id,
      character: char,
      found: true,
      images: images.map((img) => ({
        ...img,
        imageUrl: resolveImageUrl(img.imagePath),
      })),
    });
  }

  const { calligraphers, works } = getJiziCoverage({
    characterIds: knownIds,
    styleSlug: style,
  });

  return NextResponse.json({ 
    characters: results,
    calligraphers,
    works 
  });
}