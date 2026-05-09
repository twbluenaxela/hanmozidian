import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildBeItiePrompt } from "@/lib/beitie-ai";

const ALLOWED_MODELS = [
  "gemini-3.1-pro-preview",
  "gemini-3-pro-preview",
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-pro-latest",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-preview-05-20",
  "gemini-2.5-pro-preview-05-06",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash-lite-001",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  let body: {
    title?: string;
    author?: string;
    dynasty?: string;
    style?: string;
    yearLabel?: string | null;
    summary?: string | null;
    model?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { title, author, dynasty, style, yearLabel, summary } = body;
  if (!title || !author || !dynasty || !style) {
    return NextResponse.json({ error: "title, author, dynasty, style are required" }, { status: 400 });
  }

  const model =
    body.model && ALLOWED_MODELS.includes(body.model) ? body.model : "gemini-3-flash-preview";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const gemini = genAI.getGenerativeModel({ model });
    const result = await gemini.generateContent(
      buildBeItiePrompt({ title, author, dynasty, style, yearLabel, summary })
    );
    const text = result.response.text().trim();
    const jsonText = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const sections = JSON.parse(jsonText) as {
      history: string; biography: string; style: string;
      influence: string; stories: string; practice: string;
    };
    return NextResponse.json({ sections });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-ai] Gemini error:", msg);

    const isRateLimit =
      msg.includes("429") ||
      msg.toLowerCase().includes("quota exceeded") ||
      msg.toLowerCase().includes("resource has been exhausted") ||
      msg.toLowerCase().includes("too many requests");

    if (isRateLimit) {
      const lowerMsg = msg.toLowerCase();
      const isDailyQuota =
        lowerMsg.includes("perday") || lowerMsg.includes("per day") ||
        lowerMsg.includes("requestsperday") || lowerMsg.includes("limit: 0");
      if (isDailyQuota) {
        return NextResponse.json(
          { error: "daily_quota_exhausted", message: "今日免費額度已用完，請等重置時間後再試，或切換其他模型 / 專案金鑰。" },
          { status: 429 }
        );
      }
      const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
      const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
      return NextResponse.json({ error: "rate_limited", retrySeconds }, { status: 429 });
    }

    const isJsonParse = err instanceof SyntaxError || (msg.includes("JSON") && msg.includes("parse"));
    if (isJsonParse) {
      return NextResponse.json(
        { error: "parse_error", message: "模型回應格式有誤，請換個模型或重試" },
        { status: 502 }
      );
    }

    return NextResponse.json({ error: "gemini_error", message: msg }, { status: 500 });
  }
}

const MODEL_LABELS: Record<string, string> = {
  "gemini-3.1-pro-preview": "Gemini 3.1 Pro Preview",
  "gemini-3-pro-preview": "Gemini 3 Pro Preview",
  "gemini-3-flash-preview": "Gemini 3 Flash Preview",
  "gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash-Lite Preview",
  "gemini-pro-latest": "Gemini Pro Latest",
  "gemini-flash-latest": "Gemini Flash Latest",
  "gemini-flash-lite-latest": "Gemini Flash-Lite Latest",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "gemini-2.0-flash-001": "Gemini 2.0 Flash 001",
  "gemini-2.0-flash-lite": "Gemini 2.0 Flash-Lite",
  "gemini-2.0-flash-lite-001": "Gemini 2.0 Flash-Lite 001",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "gemini-2.5-flash-lite": "Gemini 2.5 Flash-Lite",
  "gemini-2.5-flash-preview-05-20": "Gemini 2.5 Flash Preview",
  "gemini-2.5-pro-preview-05-06": "Gemini 2.5 Pro Preview",
  "gemini-1.5-flash": "Gemini 1.5 Flash",
  "gemini-1.5-pro": "Gemini 1.5 Pro",
};

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
      method: "GET", cache: "no-store",
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
