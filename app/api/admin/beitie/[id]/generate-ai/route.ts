import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getBeitieById } from "@/lib/db/beitie-queries";

const ALLOWED_MODELS = [
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-pro-preview-05-06",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

const MODEL_LABELS: Record<string, string> = {
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.5-flash-preview-05-20": "Gemini 2.5 Flash Preview",
  "gemini-2.5-pro-preview-05-06": "Gemini 2.5 Pro Preview",
  "gemini-1.5-flash": "Gemini 1.5 Flash",
  "gemini-1.5-pro": "Gemini 1.5 Pro",
};

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

  const item = await getBeitieById(id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  let model = "gemini-2.5-flash";
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-ai] Gemini error:", msg);

    // 429 rate limit — only match explicit HTTP status or specific quota phrases
    const isRateLimit =
      msg.includes("429") ||
      msg.toLowerCase().includes("quota exceeded") ||
      msg.toLowerCase().includes("resource has been exhausted") ||
      msg.toLowerCase().includes("too many requests");

    if (isRateLimit) {
      const lowerMsg = msg.toLowerCase();
      const isDailyQuota =
        lowerMsg.includes("perday") ||
        lowerMsg.includes("per day") ||
        lowerMsg.includes("requestsperday") ||
        lowerMsg.includes("limit: 0");
      if (isDailyQuota) {
        return NextResponse.json(
          { error: "daily_quota_exhausted", message: "今日免費額度已用完，請等重置時間後再試，或切換其他模型 / 專案金鑰。" },
          { status: 429 }
        );
      }

      // Extract "Please retry in Xs" from the error body
      const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
      const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
      return NextResponse.json(
        { error: "rate_limited", retrySeconds },
        { status: 429 }
      );
    }

    const isJsonParse = err instanceof SyntaxError || (msg.includes("JSON") && msg.includes("parse"));
    if (isJsonParse) {
      return NextResponse.json(
        { error: "parse_error", message: "模型回應格式有誤，請換個模型或重試" },
        { status: 502 }
      );
    }

    // Return the raw Gemini message so it's visible in the UI
    return NextResponse.json({ error: "gemini_error", message: msg }, { status: 500 });
  }
}

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "model_list_failed", message: text }, { status: 502 });
    }

    const data = await res.json() as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
    const available = (data.models ?? [])
      .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m) => (m.name ?? "").replace(/^models\//, ""))
      .filter((m) => ALLOWED_MODELS.includes(m))
      .map((id) => ({ id, label: MODEL_LABELS[id] ?? id }));

    return NextResponse.json({ models: available });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "model_list_failed", message: msg }, { status: 500 });
  }
}
