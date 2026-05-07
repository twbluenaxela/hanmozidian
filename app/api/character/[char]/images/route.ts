import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getImages, getStyleCounts } from "@/lib/db/queries";
import { resolveImageUrl, parseIdList } from "@/lib/utils";
import { simplifiedToTraditional } from "@/lib/s2t";
import { getVariantSiblings } from "@/lib/variants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ char: string }> }
) {
  const { char } = await params;
  const searchParams = request.nextUrl.searchParams;
  const style = searchParams.get("style") || undefined;
  const allVariants = searchParams.get("all_variants") === "true";

  const calligrapherIds = parseIdList(searchParams.get("calligrapher"));
  const workIds = parseIdList(searchParams.get("work"));

  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") || "50") || 50), 200);

  const decoded = decodeURIComponent(char);
  let charRow = getCharacterByChar(decoded);
  if (!charRow) {
    const converted = simplifiedToTraditional(decoded);
    if (converted !== decoded) charRow = getCharacterByChar(converted);
  }
  if (!charRow) {
    return NextResponse.json({ error: "Character not found" }, { status: 404 });
  }

  // Expand to variant siblings when all_variants=true
  let characterIds = [charRow.id];
  const variantChars: string[] = [];

  if (allVariants) {
    const siblings = getVariantSiblings(charRow.character);
    if (siblings) {
      for (const sibling of siblings) {
        const sibRow = getCharacterByChar(sibling);
        if (sibRow) {
          characterIds.push(sibRow.id);
          variantChars.push(sibling);
        }
      }
    }
  }

  const styleCounts = getStyleCounts(characterIds);
  const images = getImages({
    characterIds,
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
    variantChars,
    styleCounts,
    images: processedImages,
    page,
    limit,
  });
}