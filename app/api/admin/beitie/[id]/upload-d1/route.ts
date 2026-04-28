import { NextRequest, NextResponse } from "next/server";
import { d1Query, isD1Configured } from "@/lib/db/d1-client";
import { getBeitieById, updateBeitie } from "@/lib/db/beitie-queries";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  if (!isD1Configured()) {
    return NextResponse.json(
      { error: "D1 is not configured (CF_ACCOUNT_ID/CF_API_TOKEN/D1_DATABASE_ID)" },
      { status: 500 }
    );
  }

  const item = await getBeitieById(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await d1Query(
    `INSERT INTO beitie (
      id, title, author, dynasty, style, style_slug, year_label, medium, char_count,
      summary, tags, cover_image, pages_json, shiwen, source_credit, source_url,
      ai_history, ai_biography, ai_style, ai_influence, ai_stories, ai_practice,
      ai_generated_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      author=excluded.author,
      dynasty=excluded.dynasty,
      style=excluded.style,
      style_slug=excluded.style_slug,
      year_label=excluded.year_label,
      medium=excluded.medium,
      char_count=excluded.char_count,
      summary=excluded.summary,
      tags=excluded.tags,
      cover_image=excluded.cover_image,
      pages_json=excluded.pages_json,
      shiwen=excluded.shiwen,
      source_credit=excluded.source_credit,
      source_url=excluded.source_url,
      ai_history=excluded.ai_history,
      ai_biography=excluded.ai_biography,
      ai_style=excluded.ai_style,
      ai_influence=excluded.ai_influence,
      ai_stories=excluded.ai_stories,
      ai_practice=excluded.ai_practice,
      ai_generated_at=excluded.ai_generated_at,
      updated_at=datetime('now')`,
    [
      item.id,
      item.title,
      item.author,
      item.dynasty,
      item.style,
      item.styleSlug,
      item.yearLabel,
      item.medium,
      item.charCount,
      item.summary,
      JSON.stringify(item.tags ?? []),
      item.coverImage,
      JSON.stringify(item.pages ?? []),
      item.shiwen,
      item.sourceCredit,
      item.sourceUrl,
      item.aiHistory,
      item.aiBiography,
      item.aiStyle,
      item.aiInfluence,
      item.aiStories,
      item.aiPractice,
      item.aiGeneratedAt,
    ]
  );

  const nextTags = Array.from(new Set([...(item.tags ?? []), "uploaded"]));
  await updateBeitie(id, { tags: nextTags });

  return NextResponse.json({ ok: true, id, tags: nextTags });
}
