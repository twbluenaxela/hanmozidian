import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getBeitieById, saveAiSummary } from "@/lib/db/beitie-queries";
import { buildBeItiePrompt } from "@/lib/beitie-ai";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const item = await getBeitieById(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ item });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const item = await getBeitieById(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const gemini = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await gemini.generateContent(buildBeItiePrompt(item));
    const text = result.response.text().trim();

    const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const sections = JSON.parse(jsonText) as {
      history: string;
      biography: string;
      style: string;
      influence: string;
      stories: string;
      practice: string;
    };

    await saveAiSummary(id, sections);

    return NextResponse.json({ ok: true, id });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[beitie/ai] Gemini error:", msg);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
