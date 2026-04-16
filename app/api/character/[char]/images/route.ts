import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getImages, getStyleCounts } from "@/lib/db/queries";
import { resolveImageUrl } from "@/lib/utils";


export const dynamic = 'force-dynamic';

// Parse a comma-separated list of integer ids. Accepts null (empty param),
// empty string, and single values. Returns undefined when there's nothing
// to filter on so downstream query code treats it as "no filter".
function parseIdList(raw: string | null): number[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(",")
    .map((s) => parseInt(s, 10))
    .filter((n) => Number.isFinite(n));
  return ids.length > 0 ? ids : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ char: string }> }
) {
  const { char } = await params;
  const searchParams = request.nextUrl.searchParams;
  const style = searchParams.get("style") || undefined;
  
  const calligrapherIds = parseIdList(searchParams.get("calligrapher"));
  const workIds = parseIdList(searchParams.get("work"));
  
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const charRow = getCharacterByChar(decodeURIComponent(char));
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