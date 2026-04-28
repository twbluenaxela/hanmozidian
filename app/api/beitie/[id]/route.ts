import { NextRequest, NextResponse } from "next/server";
import { getBeitieById, saveAiSummary } from "@/lib/db/beitie-queries";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const item = getBeitieById(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ item });
}

// POST /api/beitie/[id] → trigger AI summary generation
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const item = getBeitieById(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const SECTIONS = [
    { key: "history",   prompt: "請用繁體中文詳細介紹此碑帖的歷史背景、創作緣由、流傳過程，約300字。" },
    { key: "biography", prompt: "請用繁體中文介紹作者的生平、師承、藝術成就，約300字。" },
    { key: "style",     prompt: "請用繁體中文分析此碑帖的書法風格、用筆特點、結體規律，約300字。" },
    { key: "influence", prompt: "請用繁體中文介紹此碑帖對後世書法的影響與傳承，約300字。" },
    { key: "stories",   prompt: "請用繁體中文講述與此碑帖或作者相關的有趣故事和歷史典故，約300字。" },
    { key: "practice",  prompt: "請用繁體中文為書法學習者提供臨摹此碑帖的具體建議，包括用筆、結體、工具選擇等，約300字。" },
  ] as const;

  const context = `碑帖名稱：${item.title}，作者：${item.author}，朝代：${item.dynasty}，書體：${item.style}，年代：${item.yearLabel ?? "不詳"}。`;
  const results: Record<string, string> = {};

  for (const section of SECTIONS) {
    const msg = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: `${context}\n\n${section.prompt}` }],
    });
    results[section.key] = (msg.content[0] as { text: string }).text.trim();
  }

  saveAiSummary(id, {
    history:   results.history,
    biography: results.biography,
    style:     results.style,
    influence: results.influence,
    stories:   results.stories,
    practice:  results.practice,
  });

  return NextResponse.json({ ok: true, id });
}
