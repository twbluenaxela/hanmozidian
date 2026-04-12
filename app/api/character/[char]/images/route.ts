import { NextRequest, NextResponse } from "next/server";
import { getCharacterByChar, getImages, getStyleCounts } from "@/lib/db/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ char: string }> }
) {
  const { char } = await params;
  const searchParams = request.nextUrl.searchParams;
  const style = searchParams.get("style") || undefined;
  const calligrapherId = searchParams.get("calligrapher")
    ? parseInt(searchParams.get("calligrapher")!)
    : undefined;
  const workId = searchParams.get("work")
    ? parseInt(searchParams.get("work")!)
    : undefined;
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
    calligrapherId,
    workId,
    page,
    limit,
  });

  // Prepend public URL prefix for images
  const r2PublicUrl = process.env.R2_PUBLIC_URL || "";
  const processedImages = images.map((img) => ({
    ...img,
    imageUrl: r2PublicUrl
      ? `${r2PublicUrl}/${img.imagePath}`
      : `/${img.imagePath}`,
  }));

  return NextResponse.json({
    character: charRow.character,
    styleCounts,
    images: processedImages,
    page,
    limit,
  });
}
