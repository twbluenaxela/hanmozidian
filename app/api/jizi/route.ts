import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getImages, getJiziCoverage } from "@/lib/db/queries";
import { resolveImageUrl } from "@/lib/utils";

function parseIdList(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw.split(",").map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
  return ids.length > 0 ? ids : undefined;
}

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

    // INCREASE LIMIT: Fetch 50 images so the user has real "selections"
    const images = getImages({
      characterId: charRow.id,
      styleSlug: style,
      calligrapherIds,
      workIds,
      limit: 100, // INCREASED FROM 20 TO 100
      random: false, // Turn off random so results are consistent while filtering
    });

    results.push({
      id: charRow.id, // Needed for facets
      character: char,
      found: true,
      images: images.map((img) => ({
        ...img,
        imageUrl: resolveImageUrl(img.imagePath),
      })),
    });
  }

  // RE-ADD FACETS: This allows JiziPicker to show which calligraphers are available
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