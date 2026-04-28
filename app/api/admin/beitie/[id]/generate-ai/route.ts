import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getBeitieById } from "@/lib/db/beitie-queries";

const ALLOWED_MODELS = [
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-pro-preview-05-06",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

function buildPrompt(item: {
  title: string;
  author: string;
  dynasty: string;
  style: string;
  yearLabel?: string | null;
  summary?: string | null;
}) {
  return `你是一位精通中國書法史的學者，請針對以下碑帖撰寫六段中文解析內容。

碑帖資料：
- 名稱：${item.title}
- 作者：${item.author}
- 朝代：${item.dynasty}
- 書體：${item.style}${item.yearLabel ? `\n- 年代：${item.yearLabel}` : ""}${item.summary ? `\n- 簡介：${item.summary}` : ""}

請嚴格按照以下 JSON 格式輸出，不要輸出任何其他文字：

{
  "history": "歷史背景內容（200-300字）",
  "biography": "作者生平內容（200-300字）",
  "style": "書法風格分析（200-300字）",
  "influence": "影響傳承內容（200-300字）",
  "stories": "趣事典故內容（100-200字）",
  "practice": "臨摹建議（200-300字）"
}

每段可用 **粗體** 標記關鍵詞，段落之間用空行分隔（\\n\\n）。`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const item = getBeitieById(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  let model = "gemini-2.5-flash-preview-05-20";
  try {
    const body = await req.json();
    if (body.model && ALLOWED_MODELS.includes(body.model)) model = body.model;
  } catch {
    // default model
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const gemini = genAI.getGenerativeModel({ model });
    const result = await gemini.generateContent(buildPrompt(item));
    const text = result.response.text().trim();

    // Strip markdown code fences if Gemini wraps the JSON
    const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const sections = JSON.parse(jsonText) as {
      history: string;
      biography: string;
      style: string;
      influence: string;
      stories: string;
      practice: string;
    };

    return NextResponse.json({ sections });
  } catch (err: unknown) {
    // Rate limit detection — Gemini returns HTTP 429 which the SDK surfaces as an error
    const msg = err instanceof Error ? err.message : String(err);
    const isRateLimit =
      msg.includes("429") ||
      msg.toLowerCase().includes("quota") ||
      msg.toLowerCase().includes("rate") ||
      msg.toLowerCase().includes("resource has been exhausted");

    if (isRateLimit) {
      return NextResponse.json(
        { error: "rate_limited", message: "已達 API 請求上限，請稍後再試（通常 1 分鐘後重置）" },
        { status: 429 }
      );
    }

    const isJsonParse = msg.includes("JSON") || msg.includes("SyntaxError");
    if (isJsonParse) {
      return NextResponse.json(
        { error: "parse_error", message: "模型回應格式有誤，請換個模型或重試" },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "gemini_error", message: msg }, { status: 500 });
  }
}
