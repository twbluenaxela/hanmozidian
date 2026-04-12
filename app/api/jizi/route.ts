import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getImages } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get("text") || "";
  const style = searchParams.get("style") || undefined;
  const calligrapherId = searchParams.get("calligrapher")
    ? parseInt(searchParams.get("calligrapher")!)
    : undefined;
  const workId = searchParams.get("work")
    ? parseInt(searchParams.get("work")!)
    : undefined;

  if (!text) {
    return NextResponse.json({ characters: [] });
  }

  const chars = [...text];
  const r2PublicUrl = process.env.R2_PUBLIC_URL || "";

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
      calligrapherId,
      workId,
      page: 1,
      limit: 10,
    });

    results.push({
      character: char,
      found: true,
      images: images.map((img) => ({
        ...img,
        imageUrl: r2PublicUrl
          ? `${r2PublicUrl}/${img.imagePath}`
          : `/${img.imagePath}`,
      })),
    });
  }

  return NextResponse.json({ characters: results });
}
