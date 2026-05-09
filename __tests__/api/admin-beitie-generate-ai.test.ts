/**
 * @jest-environment node
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("@google/generative-ai");
jest.mock("@/lib/beitie-ai", () => ({
  buildBeItiePrompt: jest.fn(() => "mocked-prompt"),
}));

import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { POST, GET } from "@/app/api/admin/beitie/generate-ai/route";

const MockGoogleGenerativeAI = GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePostRequest(body: unknown) {
  return new NextRequest(new URL("http://localhost/api/admin/beitie/generate-ai"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeGetRequest() {
  return new NextRequest(new URL("http://localhost/api/admin/beitie/generate-ai"), {
    method: "GET",
  });
}

function makeGeminiMock(responseText: string) {
  const mockGenerateContent = jest.fn().mockResolvedValue({
    response: { text: () => responseText },
  });
  const mockGetGenerativeModel = jest.fn().mockReturnValue({
    generateContent: mockGenerateContent,
  });
  MockGoogleGenerativeAI.mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  }) as unknown as GoogleGenerativeAI);
  return { mockGenerateContent, mockGetGenerativeModel };
}

const VALID_SECTIONS = {
  history: "歷史", biography: "生平", style: "風格",
  influence: "影響", stories: "典故", practice: "建議",
};

const VALID_BODY = {
  title: "蘭亭集序",
  author: "王羲之",
  dynasty: "東晉",
  style: "行書",
};

// ── Setup / Teardown ──────────────────────────────────────────────────────────

const SAVED_KEY = process.env.GEMINI_API_KEY;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GEMINI_API_KEY = "test-api-key";
});

afterEach(() => {
  if (SAVED_KEY === undefined) {
    delete process.env.GEMINI_API_KEY;
  } else {
    process.env.GEMINI_API_KEY = SAVED_KEY;
  }
});

// ── POST — validation ─────────────────────────────────────────────────────────

describe("POST /api/admin/beitie/generate-ai", () => {
  describe("validation", () => {
    it("returns 400 when title is missing", async () => {
      const res = await POST(makePostRequest({ author: "王羲之", dynasty: "東晉", style: "行書" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it("returns 400 when author is missing", async () => {
      const res = await POST(makePostRequest({ title: "蘭亭集序", dynasty: "東晉", style: "行書" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it("returns 400 when dynasty is missing", async () => {
      const res = await POST(makePostRequest({ title: "蘭亭集序", author: "王羲之", style: "行書" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it("returns 400 when style is missing", async () => {
      const res = await POST(makePostRequest({ title: "蘭亭集序", author: "王羲之", dynasty: "東晉" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/required/i);
    });

    it("returns 400 on invalid JSON body", async () => {
      const req = new NextRequest(new URL("http://localhost/api/admin/beitie/generate-ai"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{{{",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid json/i);
    });
  });

  // ── POST — GEMINI_API_KEY guard ──────────────────────────────────────────────

  describe("API key guard", () => {
    it("returns 500 when GEMINI_API_KEY is not set", async () => {
      delete process.env.GEMINI_API_KEY;
      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toMatch(/GEMINI_API_KEY/);
    });
  });

  // ── POST — success path ───────────────────────────────────────────────────────

  describe("success path", () => {
    it("calls Gemini and returns sections on a valid request", async () => {
      makeGeminiMock(JSON.stringify(VALID_SECTIONS));
      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sections).toEqual(VALID_SECTIONS);
    });

    it("strips markdown code fences before parsing JSON from Gemini", async () => {
      makeGeminiMock("```json\n" + JSON.stringify(VALID_SECTIONS) + "\n```");
      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sections.history).toBe("歷史");
    });

    it("uses default model (gemini-3-flash-preview) when model is not provided", async () => {
      const { mockGetGenerativeModel } = makeGeminiMock(JSON.stringify(VALID_SECTIONS));
      await POST(makePostRequest(VALID_BODY));
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: "gemini-3-flash-preview" });
    });

    it("uses the model from body when it is in ALLOWED_MODELS", async () => {
      const { mockGetGenerativeModel } = makeGeminiMock(JSON.stringify(VALID_SECTIONS));
      await POST(makePostRequest({ ...VALID_BODY, model: "gemini-2.5-pro" }));
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: "gemini-2.5-pro" });
    });

    it("falls back to default model when a disallowed model is specified", async () => {
      const { mockGetGenerativeModel } = makeGeminiMock(JSON.stringify(VALID_SECTIONS));
      await POST(makePostRequest({ ...VALID_BODY, model: "gpt-4-turbo" }));
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: "gemini-3-flash-preview" });
    });

    it("passes optional yearLabel and summary to the prompt builder", async () => {
      const { buildBeItiePrompt } = require("@/lib/beitie-ai");
      makeGeminiMock(JSON.stringify(VALID_SECTIONS));
      await POST(makePostRequest({ ...VALID_BODY, yearLabel: "353年", summary: "天下第一行書" }));
      expect(buildBeItiePrompt).toHaveBeenCalledWith(
        expect.objectContaining({ yearLabel: "353年", summary: "天下第一行書" })
      );
    });
  });

  // ── POST — rate limiting ──────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 with rate_limited error and retrySeconds when API returns 429 with retry info", async () => {
      MockGoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockRejectedValue(new Error("429 Too Many Requests: retry in 45.3s")),
        }),
      }) as unknown as GoogleGenerativeAI);

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("rate_limited");
      expect(body.retrySeconds).toBe(46);
    });

    it("returns 429 with rate_limited error and null retrySeconds when no retry hint is present", async () => {
      MockGoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockRejectedValue(new Error("429 resource has been exhausted")),
        }),
      }) as unknown as GoogleGenerativeAI);

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("rate_limited");
      expect(body.retrySeconds).toBeNull();
    });

    it("returns 429 with daily_quota_exhausted error when per-day limit is hit", async () => {
      MockGoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockRejectedValue(new Error("429 quota exceeded per day: limit: 0")),
        }),
      }) as unknown as GoogleGenerativeAI);

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("daily_quota_exhausted");
      expect(typeof body.message).toBe("string");
    });
  });

  // ── POST — parse errors ───────────────────────────────────────────────────────

  describe("Gemini response parse errors", () => {
    it("returns 502 with parse_error when Gemini returns non-JSON text", async () => {
      makeGeminiMock("This is not valid JSON at all.");
      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toBe("parse_error");
    });

    it("returns 502 with parse_error when a SyntaxError is thrown during JSON.parse", async () => {
      // Simulate the SyntaxError path explicitly
      MockGoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockRejectedValue(new SyntaxError("Unexpected token")),
        }),
      }) as unknown as GoogleGenerativeAI);

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body.error).toBe("parse_error");
    });
  });

  // ── POST — general errors ─────────────────────────────────────────────────────

  describe("general Gemini errors", () => {
    it("returns 500 with gemini_error when an unexpected error is thrown", async () => {
      MockGoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
          generateContent: jest.fn().mockRejectedValue(new Error("Internal server malfunction")),
        }),
      }) as unknown as GoogleGenerativeAI);

      const res = await POST(makePostRequest(VALID_BODY));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("gemini_error");
      expect(body.message).toBe("Internal server malfunction");
    });
  });
});

// ── GET — model list ──────────────────────────────────────────────────────────

describe("GET /api/admin/beitie/generate-ai", () => {
  it("returns 500 when GEMINI_API_KEY is not set", async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/GEMINI_API_KEY/);
  });

  it("returns models filtered to ALLOWED_MODELS with labels from the Google API", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: jest.fn(),
      json: jest.fn().mockResolvedValue({
        models: [
          { name: "models/gemini-2.0-flash", supportedGenerationMethods: ["generateContent"] },
          { name: "models/gemini-2.5-pro",   supportedGenerationMethods: ["generateContent"] },
          // model not in ALLOWED_MODELS — should be filtered out
          { name: "models/gemini-unknown-model", supportedGenerationMethods: ["generateContent"] },
          // model without generateContent — should be filtered out
          { name: "models/gemini-2.5-flash", supportedGenerationMethods: ["embedContent"] },
        ],
      }),
    }) as unknown as typeof fetch;

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    const ids = body.models.map((m: { id: string }) => m.id);
    expect(ids).toContain("gemini-2.0-flash");
    expect(ids).toContain("gemini-2.5-pro");
    expect(ids).not.toContain("gemini-unknown-model");
    expect(ids).not.toContain("gemini-2.5-flash");

    const flashModel = body.models.find((m: { id: string }) => m.id === "gemini-2.0-flash");
    expect(flashModel?.label).toBe("Gemini 2.0 Flash");
  });

  it("returns 502 when the Google API response is not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      text: jest.fn().mockResolvedValue("Upstream error"),
      json: jest.fn(),
    }) as unknown as typeof fetch;

    const res = await GET();
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("model_list_failed");
  });

  it("returns 500 when the fetch itself throws a network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network failure")) as unknown as typeof fetch;

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("model_list_failed");
  });
});
