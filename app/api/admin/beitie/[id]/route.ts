import { NextRequest, NextResponse } from "next/server";
import { getBeitieById, updateBeitie, deleteBeitie } from "@/lib/db/beitie-queries";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getBeitieById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await updateBeitie(id, {
    ...(body.title !== undefined && { title: body.title as string }),
    ...(body.author !== undefined && { author: body.author as string }),
    ...(body.dynasty !== undefined && { dynasty: body.dynasty as string }),
    ...(body.style !== undefined && { style: body.style as string }),
    ...(body.styleSlug !== undefined && { styleSlug: body.styleSlug as string }),
    ...(body.yearLabel !== undefined && { yearLabel: body.yearLabel as string | null }),
    ...(body.medium !== undefined && { medium: body.medium as string | null }),
    ...(body.charCount !== undefined && { charCount: body.charCount as number | null }),
    ...(body.summary !== undefined && { summary: body.summary as string | null }),
    ...(body.tags !== undefined && { tags: body.tags as string[] }),
    ...(body.coverImage !== undefined && { coverImage: body.coverImage as string | null }),
    ...(body.pages !== undefined && { pages: body.pages as string[] }),
    ...(body.shiwen !== undefined && { shiwen: body.shiwen as string | null }),
    ...(body.sourceCredit !== undefined && { sourceCredit: body.sourceCredit as string | null }),
    ...(body.sourceUrl !== undefined && { sourceUrl: body.sourceUrl as string | null }),
    ...(body.aiHistory !== undefined && { aiHistory: body.aiHistory as string | null }),
    ...(body.aiBiography !== undefined && { aiBiography: body.aiBiography as string | null }),
    ...(body.aiStyle !== undefined && { aiStyle: body.aiStyle as string | null }),
    ...(body.aiInfluence !== undefined && { aiInfluence: body.aiInfluence as string | null }),
    ...(body.aiStories !== undefined && { aiStories: body.aiStories as string | null }),
    ...(body.aiPractice !== undefined && { aiPractice: body.aiPractice as string | null }),
    ...(body.aiGeneratedAt !== undefined && { aiGeneratedAt: body.aiGeneratedAt as string | null }),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const existing = await getBeitieById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await deleteBeitie(id);
  return NextResponse.json({ ok: true });
}
