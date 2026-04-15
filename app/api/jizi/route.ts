import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getImages } from "@/lib/db/queries";
import { resolveImageUrl } from "@/lib/utils";

// Parse a comma-separated list of integer ids
function parseIdList(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
  return ids.length > 0 ? ids : undefined;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get("text") || "";
  const style = searchParams.get("style") || undefined;
  
  const calligrapherIds = parseIdList(searchParams.get("calligrapher"));
  const workIds = parseIdList(searchParams.get("work"));

  if (!text) {
    return NextResponse.json({ characters: [] });
  }

  const chars = [...text];
  const results = [];

  for (const char of chars) {
    const charRow = getCharacterByChar(char);
    if (!charRow) {
      results.push({
        character: char,
        images: [],
        found: false,
      });
      continue;
    }

    const images = getImages({
      characterId: charRow.id,
      styleSlug: style,
      calligrapherIds,
      workIds,
      page: 1,
      limit: 10,
      random: true,
    });

    results.push({
      character: char,
      found: true,
      images: images.map((img) => ({
        ...img,
        imageUrl: resolveImageUrl(img.imagePath),
      })),
    });
  }

  return NextResponse.json({ characters: results });
}