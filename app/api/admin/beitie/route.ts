import { NextRequest, NextResponse } from "next/server";
import { listBeitie, insertBeitie } from "@/lib/db/beitie-queries";

export async function GET() {
  const items = await listBeitie();
  return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, author, dynasty, style, styleSlug } = body;
  if (!title || !author || !dynasty || !style || !styleSlug) {
    return NextResponse.json({ error: "title, author, dynasty, style, styleSlug are required" }, { status: 400 });
  }

  const hasAi = [body.aiHistory, body.aiBiography, body.aiStyle, body.aiInfluence, body.aiStories, body.aiPractice].some(Boolean);
  const id = await insertBeitie({
    title: title as string,
    author: author as string,
    dynasty: dynasty as string,
    style: style as string,
    styleSlug: styleSlug as string,
    yearLabel: (body.yearLabel as string) ?? null,
    medium: (body.medium as string) ?? null,
    charCount: (body.charCount as number) ?? null,
    summary: (body.summary as string) ?? null,
    tags: (body.tags as string[]) ?? [],
    coverImage: (body.coverImage as string) ?? null,
    pages: (body.pages as string[]) ?? [],
    shiwen: (body.shiwen as string) ?? null,
    sourceCredit: (body.sourceCredit as string) ?? null,
    sourceUrl: (body.sourceUrl as string) ?? null,
    aiHistory: (body.aiHistory as string) ?? null,
    aiBiography: (body.aiBiography as string) ?? null,
    aiStyle: (body.aiStyle as string) ?? null,
    aiInfluence: (body.aiInfluence as string) ?? null,
    aiStories: (body.aiStories as string) ?? null,
    aiPractice: (body.aiPractice as string) ?? null,
    aiGeneratedAt: hasAi ? new Date().toISOString() : null,
  });

  return NextResponse.json({ id });
}
