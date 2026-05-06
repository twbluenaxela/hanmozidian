import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getImages, getStyleCounts } from "@/lib/db/queries";
import { resolveImageUrl, parseIdList } from "@/lib/utils";
import { simplifiedToTraditional } from "@/lib/s2t";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ char: string }> }
) {
  const { char } = await params;
  const searchParams = request.nextUrl.searchParams;
  const style = searchParams.get("style") || undefined;
  
  const calligrapherIds = parseIdList(searchParams.get("calligrapher"));
  const workIds = parseIdList(searchParams.get("work"));
  
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50") || 50), 200);

  const charRow = getCharacterByChar(simplifiedToTraditional(decodeURIComponent(char)));
  if (!charRow) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  const styleCounts = getStyleCounts(charRow.id);
  const images = getImages({
    characterId: charRow.id,
    styleSlug: style,
    calligrapherIds,
    workIds,
    page,
    limit,
  });

  const processedImages = images.map((img) => ({
    ...img,
    imageUrl: resolveImageUrl(img.imagePath),
  }));

  return NextResponse.json({
    character: charRow.character,
    styleCounts,
    images: processedImages,
    page,
    limit,
  });
}